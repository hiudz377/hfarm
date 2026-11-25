import api from './client';

// GET /store -> { name, phone, zalo, email, address, hours, return_days }
// Thông tin cửa hàng do backend đọc từ .env (STORE_*, RETURN_DAYS); trường chưa cấu hình là null.
export const fetchStore = () => api.get('/store').then((r) => r.data);
