import api from './client';

// GET /auth/config -> { registration: boolean }: backend đã cấu hình để tạo tài khoản ngay trong app chưa
export const fetchAuthConfig = () => api.get('/auth/config').then((r) => r.data);

// POST /auth/register { email, password, full_name } -> { ok: true }
// Lỗi: 400 (dữ liệu sai / mật khẩu chưa đạt chính sách), 409 (email đã đăng ký), 429 (thử quá nhiều lần), 503 (chưa cấu hình / Keycloak không tới được)
export const registerAccount = ({ fullName, email, password }) =>
  api.post('/auth/register', { full_name: fullName, email, password }, { timeout: 20000 }).then((r) => r.data);
