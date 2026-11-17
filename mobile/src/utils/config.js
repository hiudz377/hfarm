// Biến EXPO_PUBLIC_* được Metro nhúng vào lúc bundle: phải viết nguyên dạng process.env.TEN_BIEN.
// Đổi .env thì phải chạy lại: npx expo start --clear
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');

// 'dev' (mặc định): coi như đã đăng nhập, gửi X-Dev-Role. Sau này thêm 'keycloak'.
export const AUTH_MODE = process.env.EXPO_PUBLIC_AUTH_MODE || 'dev';

// Gốc của backend (bỏ đuôi /api), dùng cho ảnh trong /uploads
export const API_ORIGIN = API_URL.replace(/\/api$/i, '');
