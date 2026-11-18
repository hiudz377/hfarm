// Giới hạn số yêu cầu theo IP trong một khoảng thời gian (cửa sổ cố định), lưu trong bộ nhớ của tiến trình.
// Dùng cho API công khai dễ bị lạm dụng (đăng ký). Chạy nhiều bản backend cùng lúc thì mỗi bản đếm riêng
// (cần Redis nếu muốn đếm chung). Sau reverse proxy / nginx phải đặt app.set('trust proxy', ...) để req.ip là IP khách thật.
const { httpError } = require('../utils');

function rateLimit({ windowMs, max, message = 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.' }) {
  const hits = new Map(); // ip -> { count, resetAt }
  // Dọn các khóa đã hết hạn để Map không phình mãi; unref để không giữ tiến trình sống
  setInterval(() => {
    const now = Date.now();
    for (const [key, v] of hits) if (v.resetAt <= now) hits.delete(key);
  }, Math.min(windowMs, 60 * 1000)).unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || 'unknown';
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return next(httpError(429, message));
    }
    return next();
  };
}

module.exports = { rateLimit };
