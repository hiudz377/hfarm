import { createContext, useContext, useEffect, useMemo } from 'react';
import { setTokenGetter } from '@/api/client';
import { AUTH_MODE } from '@/utils/config';

// Giao diện cố định mà phần còn lại của app dùng:
//   { status: 'loading' | 'authenticated' | 'unauthenticated', user, signOut(), getAccessToken() }
// Khi gắn Keycloak chỉ sửa file này (và nhánh else trong src/api/client.js), màn hình không phải đổi.

const DEV_USER = { id: 'dev-customer', name: 'Khách hàng (dev)', role: 'customer' };
const noToken = async () => null;
const noop = async () => {};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const value = useMemo(() => {
    if (AUTH_MODE === 'dev') {
      // Chế độ dev: luôn "đã đăng nhập" là khách hàng; client tự gắn header X-Dev-Role: customer
      return { status: 'authenticated', user: DEV_USER, signOut: noop, getAccessToken: noToken };
    }
    // TODO(keycloak): dùng expo-auth-session (đăng nhập qua trình duyệt, PKCE) rồi:
    //   - lưu refresh token bằng expo-secure-store
    //   - status: 'loading' lúc khôi phục phiên, 'authenticated' khi có token, 'unauthenticated' nếu không
    //   - getAccessToken(): trả access token, tự refresh khi gần hết hạn
    //   - signOut(): xóa token + gọi end-session của Keycloak
    return { status: 'unauthenticated', user: null, signOut: noop, getAccessToken: noToken };
  }, []);

  useEffect(() => {
    setTokenGetter(value.getAccessToken);
  }, [value]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
