import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

// Khi gắn Keycloak: gọi setTokenGetter(() => token) để mọi request tự đính kèm token
let getToken = null;
export const setTokenGetter = (fn) => { getToken = fn; };

api.interceptors.request.use((config) => {
  const token = getToken && getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const errMsg = (e) => e?.response?.data?.error || e.message || 'Có lỗi xảy ra';

export default api;
