import Keycloak from 'keycloak-js';

const env = import.meta.env;

// VITE_AUTH_DISABLED=true: chạy CMS không cần Keycloak. Chỉ dùng cùng backend AUTH_ENABLED=false.
// Mặc định tắt, nên CMS luôn bắt đăng nhập Keycloak.
export const AUTH_DISABLED = env.VITE_AUTH_DISABLED === 'true';
export const DEV_ROLE = env.VITE_DEV_ROLE === 'staff' ? 'staff' : 'admin';

const config = {
  url: env.VITE_KEYCLOAK_URL,
  realm: env.VITE_KEYCLOAK_REALM,
  clientId: env.VITE_KEYCLOAK_CLIENT_ID,
};
export const missingConfig = Object.entries({
  VITE_KEYCLOAK_URL: config.url,
  VITE_KEYCLOAK_REALM: config.realm,
  VITE_KEYCLOAK_CLIENT_ID: config.clientId,
}).filter(([, value]) => !value).map(([name]) => name);

// Token do keycloak-js giữ trong bộ nhớ, không lưu vào localStorage
export const keycloak = new Keycloak(config);

// keycloak.init chỉ được gọi một lần cho mỗi instance. React.StrictMode chạy effect hai lần,
// nên dùng chung một promise: lần gọi thứ hai nhận lại đúng promise của lần đầu.
let initPromise;
export function initKeycloak() {
  initPromise ||= keycloak.init({
    onLoad: 'login-required',
    pkceMethod: 'S256', // client hfarm-web bật "Require PKCE", thiếu thì Keycloak từ chối
    checkLoginIframe: false,
  });
  return initPromise;
}

const RELOGIN_KEY = 'hfarm:relogin-at';
const RELOGIN_COOLDOWN_MS = 15000;

// Chuyển sang trang đăng nhập Keycloak. Trả false nếu vừa đăng nhập lại cách đây chưa lâu mà
// backend vẫn từ chối token (ví dụ backend cấu hình sai realm): dừng lại để báo lỗi, tránh vòng lặp chuyển trang.
export function relogin() {
  try {
    const last = Number(sessionStorage.getItem(RELOGIN_KEY)) || 0;
    if (Date.now() - last < RELOGIN_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOGIN_KEY, String(Date.now()));
  } catch { /* sessionStorage bị chặn: vẫn đăng nhập lại, chỉ mất lớp chống lặp */ }
  keycloak.login();
  return true;
}
