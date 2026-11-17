export const money = (n) => new Intl.NumberFormat('vi-VN').format(Number(n || 0)) + ' ₫';

export const dateTime = (d) => (d ? new Date(d).toLocaleString('vi-VN') : '');

export const ORDER_STATUS = {
  PENDING: { text: 'Chờ xác nhận', color: 'gold' },
  CONFIRMED: { text: 'Đã xác nhận', color: 'blue' },
  PROCESSING: { text: 'Đang xử lý', color: 'cyan' },
  SHIPPING: { text: 'Đang giao', color: 'purple' },
  COMPLETED: { text: 'Hoàn thành', color: 'green' },
  CANCELLED: { text: 'Đã hủy', color: 'red' },
  RETURNED: { text: 'Hoàn trả', color: 'volcano' },
};

// Phải khớp với TRANSITIONS ở backend (src/services/orders.js)
export const NEXT_STATUS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['COMPLETED', 'RETURNED'],
  COMPLETED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

export const PAYMENT_STATUS = {
  UNPAID: 'Chưa thanh toán',
  PAID: 'Đã thanh toán',
  PARTIALLY_REFUNDED: 'Hoàn một phần',
  REFUNDED: 'Đã hoàn tiền',
  FAILED: 'Thất bại',
};

export const PRODUCT_STATUS = {
  DRAFT: { text: 'Nháp', color: 'default' },
  ACTIVE: { text: 'Đang bán', color: 'green' },
  INACTIVE: { text: 'Ngừng bán', color: 'red' },
};
