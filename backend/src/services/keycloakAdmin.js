// Gọi Keycloak Admin API bằng tài khoản dịch vụ của client `hfarm-backend` (client_credentials) để TẠO tài khoản khách
// ngay trong app (không phải chuyển sang trang đăng ký của Keycloak). Cấu hình một lần bằng `npm run setup:keycloak`.
// Biến môi trường: KEYCLOAK_URL, KEYCLOAK_REALM (đã có) + KEYCLOAK_ADMIN_CLIENT_ID, KEYCLOAK_ADMIN_CLIENT_SECRET.
const trimSlash = (s) => String(s || '').trim().replace(/\/+$/, '');
const TIMEOUT_MS = 10 * 1000;

// kind: 'config' (thiếu quyền / sai secret) | 'network' (không tới được Keycloak) | 'exists' (email đã có) | 'invalid' (Keycloak từ chối dữ liệu)
class KeycloakAdminError extends Error {
  constructor(kind, message, detail, field) {
    super(message);
    this.name = 'KeycloakAdminError';
    this.kind = kind;
    this.detail = detail;
    this.field = field; // trường Keycloak báo sai (firstName, lastName, email...), nếu có
  }
}

const conf = () => ({
  base: trimSlash(process.env.KEYCLOAK_URL),
  realm: String(process.env.KEYCLOAK_REALM || '').trim(),
  clientId: String(process.env.KEYCLOAK_ADMIN_CLIENT_ID || '').trim(),
  clientSecret: String(process.env.KEYCLOAK_ADMIN_CLIENT_SECRET || '').trim(),
});

// Đăng ký trong app chỉ bật khi có xác thực Keycloak VÀ đã cấu hình tài khoản dịch vụ
const isConfigured = () => {
  const c = conf();
  return process.env.AUTH_ENABLED === 'true' && !!(c.base && c.realm && c.clientId && c.clientSecret);
};

async function request(url, options = {}) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    throw new KeycloakAdminError('network', 'Không kết nối được máy chủ tài khoản (Keycloak)', e.message);
  }
}
const json = async (res) => { try { return await res.json(); } catch { return null; } };

let cached = null; // { token, expiresAt }
async function adminToken(force = false) {
  if (!force && cached && cached.expiresAt - Date.now() > 10 * 1000) return cached.token;
  const c = conf();
  const res = await request(`${c.base}/realms/${c.realm}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: c.clientId, client_secret: c.clientSecret }).toString(),
  });
  const body = await json(res);
  if (!res.ok || !body?.access_token) {
    throw new KeycloakAdminError('config', 'Không lấy được token quản trị Keycloak (sai KEYCLOAK_ADMIN_CLIENT_ID / SECRET?)', body?.error_description || body?.error || `HTTP ${res.status}`);
  }
  cached = { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 60) * 1000 };
  return cached.token;
}

// Gọi Admin API; token hết hạn / bị thu hồi (401) thì lấy token mới và thử lại đúng một lần
async function admin(path, options = {}) {
  const c = conf();
  const call = async (token) => request(`${c.base}/admin/realms/${c.realm}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
  });
  let res = await call(await adminToken());
  if (res.status === 401) res = await call(await adminToken(true));
  return res;
}

// "Nguyễn Văn An" -> firstName "Nguyễn Văn", lastName "An" (Keycloak ghép lại thành claim `name` = họ tên đầy đủ ban đầu)
function splitName(fullName) {
  const words = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { firstName: words[0] || '', lastName: '' };
  return { firstName: words.slice(0, -1).join(' '), lastName: words[words.length - 1] };
}

// Tạo tài khoản khách: đặt mật khẩu (không bắt đổi), gán role `customer`. Trả id người dùng ở Keycloak.
// Gán role lỗi thì xóa luôn tài khoản vừa tạo để không để lại tài khoản dở dang.
async function createCustomer({ email, password, fullName }) {
  const { firstName, lastName } = splitName(fullName);
  const created = await admin('/users', {
    method: 'POST',
    body: JSON.stringify({
      username: email,
      email,
      firstName,
      ...(lastName ? { lastName } : {}),
      enabled: true,
      emailVerified: false,
      credentials: [{ type: 'password', value: password, temporary: false }],
    }),
  });
  if (created.status === 409) throw new KeycloakAdminError('exists', 'Email này đã được đăng ký');
  if (created.status === 401 || created.status === 403) {
    throw new KeycloakAdminError('config', 'Tài khoản dịch vụ chưa được cấp quyền tạo người dùng (manage-users, view-realm)', `HTTP ${created.status}`);
  }
  if (!created.ok) {
    const body = await json(created);
    throw new KeycloakAdminError('invalid', body?.errorMessage || body?.error_description || body?.error || 'Keycloak từ chối thông tin đăng ký', `HTTP ${created.status} ${JSON.stringify(body)}`, body?.field);
  }
  const userId = String(created.headers.get('location') || '').split('/').pop();
  if (!userId) throw new KeycloakAdminError('network', 'Keycloak không trả về mã người dùng vừa tạo');

  try {
    const roleRes = await admin('/roles/customer');
    const role = await json(roleRes);
    if (!roleRes.ok || !role?.id) throw new KeycloakAdminError('config', 'Không tìm thấy role `customer` trong realm', `HTTP ${roleRes.status}`);
    const mapped = await admin(`/users/${userId}/role-mappings/realm`, { method: 'POST', body: JSON.stringify([role]) });
    if (!mapped.ok) throw new KeycloakAdminError('config', 'Không gán được role `customer` cho tài khoản mới', `HTTP ${mapped.status}`);
  } catch (e) {
    await admin(`/users/${userId}`, { method: 'DELETE' }).catch(() => {});
    throw e;
  }
  return userId;
}

module.exports = { KeycloakAdminError, isConfigured, createCustomer, splitName };
