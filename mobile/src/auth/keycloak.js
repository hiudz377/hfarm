import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { KEYCLOAK_CLIENT_ID, KEYCLOAK_ISSUER } from '@/utils/config';
import { clearRefreshToken, loadRefreshToken, saveRefreshToken } from './storage';
import { isConfigErrorCode, passwordGrantMessage } from './passwordErrors';

// Lõi đăng nhập Keycloak: Authorization Code + PKCE (S256) qua trình duyệt hệ thống, không có React ở đây.
// AuthProvider (React) chỉ gọi các hàm bên dưới và lắng nghe sự kiện qua subscribe().
// Nguồn: https://docs.expo.dev/versions/v58.0.0/sdk/auth-session/ , .../sdk/webbrowser/ , .../sdk/securestore/

// Chỉ có tác dụng trên web (đóng cửa sổ đăng nhập sau khi chuyển hướng về); trên Android/iOS bỏ qua
WebBrowser.maybeCompleteAuthSession();

const SCOPES = ['openid', 'profile', 'email'];
// Làm mới access token khi còn dưới ngần này giây. (Không dùng TokenResponse.shouldRefresh(): mặc định nó coi token
// hết hạn trước 10 phút, mà access token của Keycloak mặc định chỉ sống 5 phút nên lần nào cũng bị làm mới.)
const REFRESH_MARGIN_MS = 30 * 1000;
const REQUEST_TIMEOUT_MS = 15 * 1000;
const LOGOUT_TIMEOUT_MS = 5 * 1000;
// Mã lỗi OAuth khi refresh token/phiên không còn dùng được: phải đăng nhập lại (khác với lỗi mạng tạm thời)
const SESSION_REJECTED = ['invalid_grant', 'invalid_token', 'invalid_client', 'unauthorized_client'];

// kind: 'network' (không tới được Keycloak) | 'config' (sai realm/địa chỉ) | 'denied' (Keycloak trả lỗi OAuth)
export class AuthError extends Error {
  constructor(kind, message, code) {
    super(message);
    this.name = 'AuthError';
    this.kind = kind;
    this.code = code;
  }
}

// Redirect URI mà app đang dùng: phải được khai trong "Valid redirect URIs" của client hfarm-mobile.
//   Expo Go:            exp://<IP-máy-chạy-expo>:8081/--/login   (khớp mẫu exp://<IP>:8081/*)
//   Development build:  hfarm://login                            (khớp mẫu hfarm://*)
// Dùng path "login" để khi hệ điều hành mở app bằng liên kết này, Expo Router rơi đúng vào màn Đăng nhập có sẵn
// thay vì "không tìm thấy màn hình".
export const redirectUri = () => AuthSession.makeRedirectUri({ scheme: 'hfarm', path: 'login' });

function withTimeout(promise, ms = REQUEST_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new AuthError('network', 'Hết thời gian chờ Keycloak')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Lỗi do Keycloak trả về có dạng { code: 'invalid_grant', params }; còn lại (mất mạng, JSON hỏng, 5xx) coi là lỗi mạng
const isOAuthError = (e) => typeof e?.code === 'string' && e.params != null;
const asNetworkError = (e) => (e instanceof AuthError ? e : new AuthError('network', e?.message || 'Không kết nối được Keycloak'));

// ---------- Discovery ----------
let discoveryPromise = null;
export function getDiscovery() {
  if (!discoveryPromise) {
    discoveryPromise = withTimeout(AuthSession.fetchDiscoveryAsync(KEYCLOAK_ISSUER))
      .then((d) => {
        if (!d?.authorizationEndpoint || !d?.tokenEndpoint) {
          throw new AuthError('config', 'Keycloak không trả về discovery hợp lệ (sai realm hoặc địa chỉ?)');
        }
        return d;
      })
      .catch((e) => {
        discoveryPromise = null; // lần sau thử lại, không nhớ lỗi
        throw asNetworkError(e);
      });
  }
  return discoveryPromise;
}

// ---------- Phiên (chỉ trong bộ nhớ; refresh token được lưu bền ở storage.js) ----------
let session = null; // { accessToken | null, expiresAt (ms), refreshToken, userId }
const listeners = new Set();
const emit = (event) => listeners.forEach((fn) => fn(event));

// Sự kiện: { type: 'signedIn', userId } | { type: 'signedOut', reason: 'user' | 'expired' }
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const isSignedIn = () => !!session;

// Đọc claim của JWT (không kiểm tra chữ ký: chỉ để lấy sub/exp; backend mới là nơi xác thực token)
function claimsOf(jwt) {
  try {
    const part = String(jwt).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(globalThis.atob(part + '='.repeat((4 - (part.length % 4)) % 4)));
  } catch {
    return null;
  }
}

const isFresh = (s) => !!s.accessToken && s.expiresAt - Date.now() > REFRESH_MARGIN_MS;

function applyTokens(tokens, previous) {
  const refreshToken = tokens.refreshToken || previous?.refreshToken;
  session = {
    accessToken: tokens.accessToken,
    expiresAt: Date.now() + (tokens.expiresIn ?? 60) * 1000,
    refreshToken,
    userId: claimsOf(tokens.accessToken)?.sub ?? previous?.userId ?? null,
  };
  // Keycloak có thể xoay vòng refresh token: lưu lại bản mới (chỉ ghi khi có thay đổi)
  if (refreshToken && refreshToken !== previous?.refreshToken) saveRefreshToken(refreshToken);
}

async function endSession(reason, { quiet = false } = {}) {
  const had = !!session;
  session = null;
  await clearRefreshToken();
  if (had && !quiet) emit({ type: 'signedOut', reason });
}

// Phiên bị coi là hết (API trả 401 dù đã làm mới token): xóa token và báo cho giao diện về màn đăng nhập
export const expireSession = () => endSession('expired');

// ---------- Làm mới token (một yêu cầu tại một thời điểm) ----------
let refreshing = null;

async function doRefresh(quiet) {
  const current = session;
  if (!current) return null;
  try {
    const discovery = await getDiscovery();
    const tokens = await withTimeout(AuthSession.refreshAsync({ clientId: KEYCLOAK_CLIENT_ID, refreshToken: current.refreshToken }, discovery));
    if (session !== current) return session?.accessToken ?? null; // trong lúc chờ đã đăng xuất / đăng nhập lại
    applyTokens(tokens, current);
    return session.accessToken;
  } catch (e) {
    // Keycloak từ chối refresh token (hết hạn, phiên đã bị kết thúc...) -> hết phiên.
    // Còn lỗi mạng thì GIỮ phiên: người dùng không bị đá ra chỉ vì tạm mất sóng.
    if (isOAuthError(e) && SESSION_REJECTED.includes(e.code)) {
      await endSession('expired', { quiet });
      return null;
    }
    throw asNetworkError(e);
  }
}

function refreshSession(quiet = false) {
  if (!refreshing) refreshing = doRefresh(quiet).finally(() => { refreshing = null; });
  return refreshing;
}

// Trả access token còn hạn (tự làm mới khi sắp hết); null nếu chưa đăng nhập hoặc phiên đã hết.
// force = true: làm mới ngay cả khi token chưa hết hạn (dùng khi backend vừa trả 401).
// Ném AuthError('network') nếu cần làm mới mà không tới được Keycloak.
export async function getAccessToken({ force = false } = {}) {
  if (!session) return null;
  if (!force && isFresh(session)) return session.accessToken;
  return refreshSession();
}

// Khôi phục phiên đã lưu khi mở app. Trả { userId } nếu còn phiên, null nếu phải đăng nhập lại.
export async function restoreSession() {
  const refreshToken = await loadRefreshToken();
  if (!refreshToken) return null;
  const claims = claimsOf(refreshToken);
  if (claims?.exp && claims.exp * 1000 < Date.now()) {
    await clearRefreshToken();
    return null;
  }
  session = { accessToken: null, expiresAt: 0, refreshToken, userId: claims?.sub ?? null };
  try {
    await refreshSession(true);
  } catch {
    // Đang offline: vẫn coi là đã đăng nhập, token sẽ được làm mới ở request đầu tiên khi có mạng
  }
  return session ? { userId: session.userId } : null;
}

// ---------- Đăng nhập / đăng ký / đăng xuất ----------
// create = true: mở thẳng trang đăng ký của Keycloak (prompt=create, Keycloak >= 26.1; xem prompt_values_supported)
// Trả { status: 'signedIn' } hoặc { status: 'cancelled' } (người dùng đóng trình duyệt). Lỗi thì ném AuthError.
export async function signIn({ create = false } = {}) {
  const discovery = await getDiscovery();
  const uri = redirectUri();
  const request = new AuthSession.AuthRequest({
    clientId: KEYCLOAK_CLIENT_ID,
    redirectUri: uri,
    scopes: SCOPES,
    usePKCE: true, // mặc định đã là true + S256; ghi rõ vì client hfarm-mobile bật "Require PKCE"
    extraParams: create ? { prompt: 'create' } : undefined,
  });

  let result;
  try {
    result = await request.promptAsync(discovery);
  } catch (e) {
    throw asNetworkError(e);
  }
  if (result.type === 'error') {
    throw new AuthError('denied', result.error?.description || result.error?.message || 'Đăng nhập không thành công', result.error?.code);
  }
  if (result.type !== 'success') return { status: 'cancelled' }; // cancel | dismiss | locked

  const code = result.params?.code;
  if (!code) throw new AuthError('denied', 'Keycloak không trả về mã đăng nhập');
  let tokens;
  try {
    tokens = await withTimeout(AuthSession.exchangeCodeAsync({
      clientId: KEYCLOAK_CLIENT_ID,
      code,
      redirectUri: uri,
      extraParams: { code_verifier: request.codeVerifier },
    }, discovery));
  } catch (e) {
    if (isOAuthError(e)) throw new AuthError('denied', e.description || e.message, e.code);
    throw asNetworkError(e);
  }
  applyTokens(tokens, null);
  emit({ type: 'signedIn', userId: session.userId });
  return { status: 'signedIn' };
}

// Đăng nhập bằng email + mật khẩu NGAY TRONG APP (không mở trình duyệt): gửi thẳng tới token endpoint của Keycloak
// (OAuth password grant). Cần bật "Direct access grants" cho client hfarm-mobile (chạy `npm run setup:keycloak` ở backend).
// Trả { status: 'signedIn' }. Lỗi: AuthError('denied', ..., 'invalid_grant') khi sai thông tin / tài khoản bị khóa,
// AuthError('config', ..., 'unauthorized_client') khi client chưa bật Direct access grants, AuthError('network') khi mất kết nối.
export async function signInWithPassword({ email, password }) {
  const discovery = await getDiscovery();
  let res;
  try {
    res = await withTimeout(fetch(discovery.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: KEYCLOAK_CLIENT_ID,
        username: String(email).trim(),
        password,
        scope: SCOPES.join(' '),
      }).toString(),
    }));
  } catch (e) {
    throw asNetworkError(e);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) {
    const code = data?.error;
    const description = data?.error_description;
    if (!code) throw new AuthError('network', `Keycloak trả về lỗi ${res.status}`); // 5xx / phản hồi lạ: coi là lỗi tạm thời
    throw new AuthError(isConfigErrorCode(code) ? 'config' : 'denied', description || code, code);
  }
  applyTokens({ accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in }, null);
  emit({ type: 'signedIn', userId: session.userId });
  return { status: 'signedIn' };
}

// Xóa phiên cục bộ ngay (giao diện đổi tức thì) rồi kết thúc phiên ở Keycloak. Dùng đăng xuất trực tiếp
// (POST end_session_endpoint kèm refresh_token): phiên ở Keycloak bị hủy nên cookie đăng nhập trong trình duyệt
// cũng vô hiệu, không cần mở trình duyệt và không cần khai "post logout redirect URI". Lỗi mạng thì bỏ qua:
// phiên ở Keycloak sẽ tự hết hạn.
export async function signOut() {
  const current = session;
  await endSession('user');
  if (!current?.refreshToken) return;
  try {
    const discovery = await getDiscovery();
    if (!discovery.endSessionEndpoint) return;
    await withTimeout(fetch(discovery.endSessionEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: KEYCLOAK_CLIENT_ID, refresh_token: current.refreshToken }).toString(),
    }), LOGOUT_TIMEOUT_MS);
  } catch { /* best-effort */ }
}

// Thông báo tiếng Việt cho người dùng. Chi tiết kỹ thuật (địa chỉ Keycloak...) chỉ hiện ở bản dev.
export function authErrorMessage(e) {
  const hint = __DEV__ ? ` [dev] Keycloak: ${KEYCLOAK_ISSUER || 'chưa đặt EXPO_PUBLIC_KEYCLOAK_URL/REALM'}. Điện thoại phải truy cập được địa chỉ này (cùng Wi-Fi, tường lửa cho cổng 8080).` : '';
  if (e?.kind === 'network') return `Không kết nối được máy chủ đăng nhập. Kiểm tra mạng rồi thử lại.${hint}`;
  if (e?.kind === 'config') return `Cấu hình đăng nhập chưa đúng. Vui lòng liên hệ cửa hàng.${__DEV__ ? ` [dev] ${e.message}` : ''}`;
  if (e?.kind === 'denied') {
    const viet = passwordGrantMessage(e.code, e.message); // đăng nhập bằng mật khẩu: sai thông tin, tài khoản khóa...
    if (viet) return viet;
    return e.code === 'access_denied'
      ? 'Đăng nhập bị từ chối.'
      : `Đăng nhập không thành công${e.code ? ` (${e.code})` : ''}. Vui lòng thử lại.${__DEV__ && e.message ? ` [dev] ${e.message}` : ''}`;
  }
  return e?.message || 'Đăng nhập không thành công. Vui lòng thử lại.';
}
