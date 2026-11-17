import axios, { AxiosError } from 'axios';
import { API_URL, AUTH_MODE } from '@/utils/config';
import { viMessage } from '@/utils/viMessage';

// Axios instance DUY NHẤT của app. Mọi file trong src/api đều import từ đây.
const api = axios.create({
  baseURL: API_URL,
  // Có timeout để sai IP thì báo lỗi sớm, không quay vòng mãi
  timeout: 10000,
});

// AuthProvider đăng ký vào đây (chỉ dùng khi không ở chế độ dev):
//   tokenGetter({ force })  -> access token còn hạn (tự làm mới), null nếu chưa đăng nhập / phiên đã hết
//   unauthorizedHandler()   -> báo phiên không còn dùng được để app về màn đăng nhập
let tokenGetter = null;
export const setTokenGetter = (fn) => {
  tokenGetter = fn;
};
let unauthorizedHandler = null;
export const setUnauthorizedHandler = (fn) => {
  unauthorizedHandler = fn;
};

api.interceptors.request.use(async (config) => {
  if (AUTH_MODE === 'dev') {
    // Chế độ dev: backend (AUTH_ENABLED != true) chọn vai trò theo header này
    config.headers['X-Dev-Role'] = 'customer';
  } else {
    let token = null;
    try {
      token = tokenGetter ? await tokenGetter() : null;
    } catch {
      // Cần làm mới token mà không tới được Keycloak: báo như lỗi mạng (giữ phiên, người dùng bấm "Thử lại")
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    }
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 = backend không chấp nhận token: làm mới token cưỡng bức và gửi lại đúng một lần.
// Vẫn 401 (hoặc refresh bị Keycloak từ chối) thì phiên đã hết -> unauthorizedHandler đưa app về màn đăng nhập.
api.interceptors.response.use(undefined, async (error) => {
  const { config, response } = error;
  if (AUTH_MODE !== 'dev' && response?.status === 401 && config && tokenGetter) {
    if (!config._authRetried) {
      config._authRetried = true;
      let token = null;
      try {
        token = await tokenGetter({ force: true });
      } catch {
        return Promise.reject(error); // không tới được Keycloak: giữ phiên
      }
      if (token) return api(config); // request interceptor sẽ gắn token mới
    } else {
      unauthorizedHandler?.();
    }
  }
  return Promise.reject(error);
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
