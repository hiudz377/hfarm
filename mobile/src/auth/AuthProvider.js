import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setTokenGetter, setUnauthorizedHandler } from '@/api/client';
import { AUTH_MODE, KEYCLOAK_CLIENT_ID, KEYCLOAK_ISSUER, KEYCLOAK_MISSING } from '@/utils/config';
import { PRIVATE_QUERY_KEYS } from '@/utils/queryKeys';
import * as keycloak from './keycloak';

// Giao diện cố định mà phần còn lại của app dùng:
//   {
//     status: 'loading' | 'authenticated' | 'unauthenticated',
//     user,                 // { id, ... } hoặc null; tên + email của người dùng lấy từ GET /api/me
//     sessionExpired,       // true khi phiên vừa hết (token bị từ chối, refresh token hết hạn)
//     signInWithPassword({ email, password })  // đăng nhập ngay trong app (không mở trình duyệt)
//     signIn(), signUp(),   // mở trang Keycloak (dự phòng, quên mật khẩu); trả { status: 'signedIn' | 'cancelled' } hoặc ném AuthError
//     signOut(), getAccessToken(opts), acknowledgeExpired()
//   }
// Chế độ dev (EXPO_PUBLIC_AUTH_MODE=dev): luôn "đã đăng nhập" là khách hàng, client tự gắn header X-Dev-Role.

const DEV_USER = { id: 'dev-customer', name: 'Khách hàng (dev)', role: 'customer' };
const noToken = async () => null;
const noop = async () => {};

const DEV_VALUE = {
  status: 'authenticated',
  user: DEV_USER,
  sessionExpired: false,
  signIn: async () => ({ status: 'signedIn' }),
  signUp: async () => ({ status: 'signedIn' }),
  signInWithPassword: async () => ({ status: 'signedIn' }),
  signOut: noop,
  getAccessToken: noToken,
  acknowledgeExpired: () => {},
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  // Thiếu biến Keycloak thì không có gì để khôi phục: vào thẳng trạng thái chưa đăng nhập (signIn sẽ báo thiếu biến nào)
  const [state, setState] = useState(() => {
    if (AUTH_MODE === 'dev') return { status: 'authenticated' };
    return { status: KEYCLOAK_MISSING.length ? 'unauthenticated' : 'loading', user: null, expired: false };
  });

  useEffect(() => {
    if (AUTH_MODE === 'dev') {
      setTokenGetter(noToken);
      return undefined;
    }
    setTokenGetter(keycloak.getAccessToken);
    setUnauthorizedHandler(keycloak.expireSession);

    if (__DEV__) {
      // Để đối chiếu với "Valid redirect URIs" của client trong Keycloak
      console.log(`[auth] Keycloak: ${KEYCLOAK_ISSUER || '(chưa cấu hình)'} | client: ${KEYCLOAK_CLIENT_ID || '(chưa cấu hình)'}`);
      console.log(`[auth] Redirect URI đang dùng: ${keycloak.redirectUri()}`);
      if (KEYCLOAK_MISSING.length) console.warn(`[auth] Thiếu biến môi trường: ${KEYCLOAK_MISSING.join(', ')}`);
    }

    let active = true;
    // Dữ liệu riêng (giỏ, đơn, địa chỉ, hồ sơ) thuộc về phiên cũ: xóa mỗi khi phiên đổi
    const dropPrivateData = () => PRIVATE_QUERY_KEYS.forEach((queryKey) => queryClient.removeQueries({ queryKey }));
    const off = keycloak.subscribe((event) => {
      dropPrivateData();
      if (event.type === 'signedIn') setState({ status: 'authenticated', user: { id: event.userId }, expired: false });
      else setState({ status: 'unauthenticated', user: null, expired: event.reason === 'expired' });
    });

    if (!KEYCLOAK_MISSING.length) {
      keycloak.restoreSession()
        .then((restored) => {
          if (active) setState(restored ? { status: 'authenticated', user: { id: restored.userId }, expired: false } : { status: 'unauthenticated', user: null, expired: false });
        })
        .catch(() => active && setState({ status: 'unauthenticated', user: null, expired: false }));
    }
    return () => {
      active = false;
      off();
    };
  }, [queryClient]);

  const acknowledgeExpired = useCallback(() => setState((s) => (s.expired ? { ...s, expired: false } : s)), []);

  const value = useMemo(() => {
    if (AUTH_MODE === 'dev') return DEV_VALUE;
    const guard = (fn) => async (...args) => {
      if (KEYCLOAK_MISSING.length) {
        throw new keycloak.AuthError('config', `Thiếu biến môi trường: ${KEYCLOAK_MISSING.join(', ')}`);
      }
      return fn(...args);
    };
    return {
      status: state.status,
      user: state.user,
      sessionExpired: !!state.expired,
      signIn: guard(() => keycloak.signIn()),
      signUp: guard(() => keycloak.signIn({ create: true })),
      signInWithPassword: guard((credentials) => keycloak.signInWithPassword(credentials)),
      signOut: keycloak.signOut,
      getAccessToken: keycloak.getAccessToken,
      acknowledgeExpired,
    };
  }, [state, acknowledgeExpired]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
