// Giá trị trùng với backend (orders -> payments.payment_method): 'COD' | 'BANK_TRANSFER'
export const PAYMENT_METHODS = [
  { value: 'COD', title: 'Thanh toán khi nhận hàng (COD)', hint: 'Trả tiền mặt cho người giao hàng' },
  { value: 'BANK_TRANSFER', title: 'Chuyển khoản ngân hàng', hint: 'Chuyển khoản theo thông tin bên dưới' },
];

// Có thêm ONLINE vì backend cho phép (app chưa cho chọn)
export const paymentLabel = (value) =>
  PAYMENT_METHODS.find((m) => m.value === value)?.title ?? (value === 'ONLINE' ? 'Thanh toán trực tuyến' : value);
