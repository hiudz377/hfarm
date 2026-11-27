// Thông báo lỗi từ backend đôi khi chứa mã trạng thái tiếng Anh (ví dụ "Không thể chuyển từ CONFIRMED sang CANCELLED").
// Đổi sang nhãn tiếng Việt trước khi hiện cho người dùng. Không import gì để test được bằng Node thuần.
const STATUS_VI = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PROCESSING: 'Đang xử lý',
  SHIPPING: 'Đang giao',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  RETURNED: 'Hoàn trả',
};

export const viMessage = (msg) =>
  String(msg ?? '').replace(/\b(PENDING|CONFIRMED|PROCESSING|SHIPPING|COMPLETED|CANCELLED|RETURNED)\b/g, (s) => STATUS_VI[s]);

// Quote / đặt hàng báo "Sản phẩm (mã 12) không còn bán": lấy mã mẫu mã để đánh dấu đúng dòng trong giỏ.
// Trả về số, hoặc null nếu lỗi không phải kiểu này.
export function goneVariantId(message) {
  const m = /Sản phẩm \(mã (\d+)\) không còn bán/.exec(String(message ?? ''));
  return m ? Number(m[1]) : null;
}
