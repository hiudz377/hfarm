import api from './client';

// GET /payments/methods -> { methods: [{ value: 'COD' }, { value: 'BANK_TRANSFER', hold_minutes, auto_confirm }] }
// Chỉ hiện các phương thức server đang bật (chuyển khoản tắt khi cửa hàng chưa cấu hình tài khoản ngân hàng).
export const fetchPaymentMethods = () => api.get('/payments/methods').then((r) => r.data);
