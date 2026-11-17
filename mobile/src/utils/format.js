import { API_ORIGIN } from './config';

// 1250000 -> "1.250.000 ₫" (tự định dạng, không phụ thuộc Intl của thiết bị)
export function money(n) {
  const v = Math.round(Number(n) || 0);
  const digits = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${v < 0 ? '-' : ''}${digits} ₫`;
}

export const dateTime = (d) => {
  if (!d) return '';
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(x.getDate())}/${p(x.getMonth() + 1)}/${x.getFullYear()} ${p(x.getHours())}:${p(x.getMinutes())}`;
};

// Backend lưu URL ảnh theo PUBLIC_URL (mặc định http://localhost:3000). Điện thoại không với tới
// "localhost" nên đổi sang host của API đang dùng. URL của domain thật được giữ nguyên.
export function resolveImageUrl(url) {
  if (!url) return null;
  if (url.startsWith('/')) return API_ORIGIN + url;
  return url.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, API_ORIGIN);
}
