import api from './client';

// GET /shipping/estimate?province=&subtotal= -> { zone_name, fee, free_over, eta_min_days, eta_max_days } (công khai)
// Bỏ province = vùng mặc định. fee đã tính miễn phí theo subtotal.
export const fetchShippingEstimate = ({ province, subtotal } = {}) =>
  api.get('/shipping/estimate', { params: { province: province || undefined, subtotal: subtotal || undefined } }).then((r) => r.data);
