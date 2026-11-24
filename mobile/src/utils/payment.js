// Giá trị trùng với backend (orders -> payments.payment_method): 'COD' | 'BANK_TRANSFER' | 'ONLINE'
// Phương thức nào đang bật do server quyết định (GET /payments/methods): chuyển khoản chỉ hiện khi cửa hàng đã cấu hình tài khoản.
export const PAYMENT_METHODS = [
  { value: 'COD', title: 'Thanh toán khi nhận hàng (COD)', hint: 'Trả tiền mặt cho người giao hàng', icon: 'cash-outline' },
  { value: 'BANK_TRANSFER', title: 'Chuyển khoản ngân hàng (QR)', hint: 'Quét mã VietQR bằng app ngân hàng', icon: 'qr-code-outline' },
];

// Có thêm ONLINE vì backend cho phép (app chưa cho chọn)
export const paymentLabel = (value) =>
  PAYMENT_METHODS.find((m) => m.value === value)?.title ?? (value === 'ONLINE' ? 'Thanh toán trực tuyến' : value);
