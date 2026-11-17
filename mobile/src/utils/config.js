// Biến EXPO_PUBLIC_* được Metro nhúng vào lúc bundle: phải viết nguyên dạng process.env.TEN_BIEN.
// Đổi .env thì phải chạy lại: npx expo start --clear
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');

// 'dev' (mặc định): coi như đã đăng nhập, gửi X-Dev-Role. 'keycloak': đăng nhập thật qua Keycloak.
export const AUTH_MODE = process.env.EXPO_PUBLIC_AUTH_MODE || 'dev';

// Keycloak (chỉ dùng khi AUTH_MODE=keycloak). URL phải là địa chỉ ĐIỆN THOẠI truy cập được (IP LAN, không phải localhost).
// Issuer của token = KEYCLOAK_URL + /realms/ + realm, nên backend phải liệt kê đúng issuer này (KEYCLOAK_ISSUERS).
export const KEYCLOAK_URL = (process.env.EXPO_PUBLIC_KEYCLOAK_URL || '').replace(/\/+$/, '');
export const KEYCLOAK_REALM = process.env.EXPO_PUBLIC_KEYCLOAK_REALM || '';
export const KEYCLOAK_CLIENT_ID = process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID || '';
export const KEYCLOAK_ISSUER = KEYCLOAK_URL && KEYCLOAK_REALM ? `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}` : '';

// Tên các biến Keycloak còn thiếu (rỗng = đủ)
export const KEYCLOAK_MISSING = [
  ['EXPO_PUBLIC_KEYCLOAK_URL', KEYCLOAK_URL],
  ['EXPO_PUBLIC_KEYCLOAK_REALM', KEYCLOAK_REALM],
  ['EXPO_PUBLIC_KEYCLOAK_CLIENT_ID', KEYCLOAK_CLIENT_ID],
].filter(([, value]) => !value).map(([name]) => name);

// Gốc của backend (bỏ đuôi /api), dùng cho ảnh trong /uploads
export const API_ORIGIN = API_URL.replace(/\/api$/i, '');
