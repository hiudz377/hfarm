import { useEffect, useState } from 'react';

// Đếm ngược theo giây từ số giây SERVER trả về (không dùng đồng hồ máy khách để so với hạn, tránh lệch múi giờ / đồng hồ sai).
// seconds: số giây còn lại tại thời điểm dữ liệu được tải (updatedAt, ms). Trả null nếu seconds null/undefined, ngược lại số giây còn lại (>= 0).
export function useCountdown(seconds, updatedAt) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (seconds == null || seconds <= 0) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [seconds, updatedAt]);
  if (seconds == null) return null;
  return Math.max(seconds - Math.floor((now - (updatedAt || now)) / 1000), 0);
}
