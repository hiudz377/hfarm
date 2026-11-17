import axios from 'axios';
import { API_URL, AUTH_MODE } from '@/utils/config';
import { viMessage } from '@/utils/viMessage';

// Axios instance DUY NHẤT của app. Mọi file trong src/api đều import từ đây.
const api = axios.create({
  baseURL: API_URL,
  // Có timeout để sai IP thì báo lỗi sớm, không quay vòng mãi
  timeout: 10000,
});

// AuthProvider đăng ký hàm lấy token vào đây (chỉ dùng khi không ở chế độ dev)
let tokenGetter = null;
export const setTokenGetter = (fn) => {
  tokenGetter = fn;
};

api.interceptors.request.use(async (config) => {
  if (AUTH_MODE === 'dev') {
    // Chế độ dev: backend (AUTH_ENABLED != true) chọn vai trò theo header này
    config.headers['X-Dev-Role'] = 'customer';
  } else {
    // TODO(keycloak): getAccessToken() trả về access token (tự refresh nếu sắp hết hạn)
    const token = tokenGetter ? await tokenGetter() : null;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Thông báo lỗi tiếng Việt cho người dùng (địa chỉ API và gợi ý cấu hình chỉ hiện ở bản dev)
export function errMsg(e) {
  if (e?.response) return viMessage(e.response.data?.error) || `Lỗi máy chủ (${e.response.status})`;
  if (e?.code === 'ECONNABORTED' || e?.code === 'ETIMEDOUT') return 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.';
  if (e?.isAxiosError) {
    const hint = __DEV__ ? ` [dev] API: ${API_URL || 'chưa đặt EXPO_PUBLIC_API_URL'}. Kiểm tra backend đang chạy và điện thoại cùng Wi-Fi.` : '';
    return `Không kết nối được máy chủ. Kiểm tra kết nối mạng rồi thử lại.${hint}`;
  }
  return e?.message || 'Có lỗi xảy ra';
}
export default api;
