import axios from 'axios';
import { AUTH_DISABLED, DEV_ROLE, keycloak, relogin } from './auth/keycloak';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

// Trước mỗi request: làm mới token nếu còn dưới 30 giây rồi gắn Authorization: Bearer.
// (keycloak-js tự gộp các lần làm mới đồng thời thành một.)
api.interceptors.request.use(async (config) => {
  if (AUTH_DISABLED) {
    config.headers['X-Dev-Role'] = DEV_ROLE; // chỉ có tác dụng khi backend AUTH_ENABLED=false
    return config;
  }
  try {
    await keycloak.updateToken(30);
  } catch {
    // Phiên Keycloak đã hết (refresh token hết hạn): đăng nhập lại
    relogin();
    return new Promise(() => {}); // trang sắp chuyển hướng nên không trả kết quả
  }
  config.headers.Authorization = `Bearer ${keycloak.token}`;
  return config;
});

api.interceptors.response.use(undefined, async (error) => {
  const status = error.response?.status;
  if (status === 401 && !AUTH_DISABLED) {
    // Thử làm mới token cưỡng bức và gửi lại đúng một lần, sau đó mới đăng nhập lại
    const config = error.config;
    if (config && !config._retried) {
      config._retried = true;
      let refreshed = false;
      try {
        await keycloak.updateToken(-1);
        refreshed = true;
      } catch { /* refresh token đã hết hạn: đăng nhập lại bên dưới */ }
      // Lần gửi lại mà vẫn 401 thì lại vào đúng interceptor này (_retried = true) và đăng nhập lại
      if (refreshed) return api(config);
    }
    relogin();
  } else if (status === 403) {
    window.dispatchEvent(new CustomEvent('hfarm:forbidden', { detail: error.response.data?.error }));
  }
  return Promise.reject(error);
});

export const errMsg = (e) => e?.response?.data?.error || e.message || 'Có lỗi xảy ra';

export default api;
