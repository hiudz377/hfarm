// Nhãn + màu trạng thái đơn hàng. Khóa trùng với backend (services/orders.js -> TRANSITIONS).
export const ORDER_STATUS = {
  PENDING: { label: 'Chờ xác nhận', color: '#B26A00', bg: '#FFF3E0' },
  CONFIRMED: { label: 'Đã xác nhận', color: '#1565C0', bg: '#E3F2FD' },
  PROCESSING: { label: 'Đang xử lý', color: '#1565C0', bg: '#E3F2FD' },
  SHIPPING: { label: 'Đang giao', color: '#00796B', bg: '#E0F2F1' },
  COMPLETED: { label: 'Hoàn thành', color: '#2E7D32', bg: '#E8F5E9' },
  CANCELLED: { label: 'Đã hủy', color: '#C62828', bg: '#FDECEA' },
  RETURNED: { label: 'Hoàn trả', color: '#6D4C41', bg: '#EFEBE9' },
};
export const orderStatus = (s) => ORDER_STATUS[s] ?? { label: String(s ?? ''), color: '#6B756B', bg: '#EEF1EE' };

// Bộ lọc ở tab Đơn hàng. `status` gửi thẳng lên GET /orders?status= (nhiều trạng thái cách nhau dấu phẩy).
// Gom nhóm để đơn nào cũng nằm trong ít nhất một bộ lọc: "Đang giao" gồm cả đã xác nhận / đang xử lý
// (nhãn trên từng thẻ vẫn hiện đúng trạng thái thật); "Đã hủy" gồm cả đã hoàn trả.
export const ORDER_FILTERS = [
  { key: 'all', label: 'Tất cả', status: undefined },
  { key: 'pending', label: 'Chờ xác nhận', status: 'PENDING' },
  { key: 'shipping', label: 'Đang giao', status: 'CONFIRMED,PROCESSING,SHIPPING' },
  { key: 'completed', label: 'Hoàn thành', status: 'COMPLETED' },
  { key: 'cancelled', label: 'Đã hủy', status: 'CANCELLED,RETURNED' },
];

export const PAYMENT_STATUS_LABEL = {
  UNPAID: 'Chưa thanh toán',
  PAID: 'Đã thanh toán',
  PARTIALLY_REFUNDED: 'Đã hoàn một phần',
  REFUNDED: 'Đã hoàn tiền',
  FAILED: 'Thanh toán thất bại',
};
export const paymentStatusLabel = (s) => PAYMENT_STATUS_LABEL[s] ?? String(s ?? '');

export const SHIPMENT_STATUS_LABEL = {
  PENDING: 'Chờ lấy hàng',
  PICKING: 'Đang lấy hàng',
  IN_TRANSIT: 'Đang vận chuyển',
  DELIVERED: 'Đã giao',
  FAILED: 'Giao không thành công',
  RETURNED: 'Hoàn hàng',
};
export const shipmentStatusLabel = (s) => SHIPMENT_STATUS_LABEL[s] ?? String(s ?? '');
