// Kiểm tra form trước khi lưu. Trả về null nếu có ô chưa hợp lệ (lỗi đã hiện ngay dưới từng ô),
// tránh để lỗi kiểm tra form thành "unhandled rejection" trong console.
export const validate = (form) => form.validateFields().catch(() => null);

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

// Trang Đơn hàng gom 7 trạng thái thành 5 nhóm công việc để lọc nhanh (CONFIRMED + PROCESSING = "Đang chuẩn bị")
export const ORDER_GROUPS = [
  { key: 'PENDING', label: 'Chờ xác nhận', statuses: ['PENDING'], color: 'gold' },
  { key: 'PREPARING', label: 'Đang chuẩn bị', statuses: ['CONFIRMED', 'PROCESSING'], color: 'blue' },
  { key: 'SHIPPING', label: 'Đang giao', statuses: ['SHIPPING'], color: 'purple' },
  { key: 'COMPLETED', label: 'Hoàn tất', statuses: ['COMPLETED'], color: 'green' },
  { key: 'CLOSED', label: 'Hủy / hoàn trả', statuses: ['CANCELLED', 'RETURNED'], color: 'red' },
];

// Nhãn + màu hiển thị gọn của một đơn: gộp CONFIRMED/PROCESSING thành "Đang chuẩn bị", còn lại giữ nhãn gốc
export const orderTag = (status) => (['CONFIRMED', 'PROCESSING'].includes(status)
  ? { text: 'Đang chuẩn bị', color: 'blue' }
  : ORDER_STATUS[status]);

// Thao tác xử lý đơn (khớp BULK_ACTIONS ở backend src/services/orders.js).
// Xác nhận / Giao hàng / Hoàn tất là "bước tiếp theo" (nút chính); Hủy và Hoàn trả là thao tác phụ.
export const ORDER_ACTIONS = {
  confirm: { label: 'Xác nhận', done: 'Đã xác nhận', from: ['PENDING'] },
  ship: { label: 'Giao hàng', done: 'Đã chuyển sang đang giao', from: ['CONFIRMED', 'PROCESSING'] },
  complete: { label: 'Hoàn tất', done: 'Đã hoàn tất', from: ['SHIPPING'] },
  cancel: { label: 'Hủy đơn', verb: 'Hủy', done: 'Đã hủy', from: ['PENDING', 'CONFIRMED', 'PROCESSING'], danger: true },
  return: { label: 'Hoàn trả', verb: 'Hoàn trả', done: 'Đã hoàn trả', from: ['SHIPPING', 'COMPLETED'], danger: true },
};
// Tiêu đề hộp xác nhận cho Hủy / Hoàn trả: "Hủy đơn HT2026…?" hoặc "Hủy 3 đơn?"
export const dangerTitle = (action, ids, code) => (ids.length > 1
  ? `${ORDER_ACTIONS[action].verb} ${ids.length} đơn?`
  : `${ORDER_ACTIONS[action].verb} đơn ${code}?`);
export const NEXT_ACTIONS = ['confirm', 'ship', 'complete'];
export const nextActionOf = (status) => NEXT_ACTIONS.find((a) => ORDER_ACTIONS[a].from.includes(status)) || null;
export const actionsOf = (status) => Object.keys(ORDER_ACTIONS).filter((a) => ORDER_ACTIONS[a].from.includes(status));

export const PAYMENT_METHOD = { COD: 'COD', BANK_TRANSFER: 'Chuyển khoản', ONLINE: 'Online' };

export const PAYMENT_STATUS = {
  UNPAID: 'Chưa thanh toán',
  PAID: 'Đã thanh toán',
  PARTIALLY_REFUNDED: 'Hoàn một phần',
  REFUNDED: 'Đã hoàn tiền',
  FAILED: 'Thất bại',
};

export const REVIEW_STATUS = {
  PENDING: { text: 'Chờ duyệt', color: 'gold' },
  APPROVED: { text: 'Đã duyệt', color: 'green' },
  REJECTED: { text: 'Đã ẩn', color: 'default' },
};

export const PRODUCT_STATUS = {
  DRAFT: { text: 'Nháp', color: 'default' },
  ACTIVE: { text: 'Đang bán', color: 'green' },
  INACTIVE: { text: 'Ngừng bán', color: 'red' },
};

// ---- Size: nhóm chữ / số / khác (cùng cách suy ra với backend/src/services/sizes.js) ----
const normSize = (name) => String(name ?? '').trim().toUpperCase().replace(/\s+/g, '');
export const sizeGroup = (name) => {
  const n = normSize(name);
  if (/^(?:\d{1,2}XL|X{1,4}[SL]|[SML])$/.test(n)) return 'LETTER';
  if (/^\d{1,3}(?:[.,]\d+)?$/.test(n)) return 'NUMBER';
  return 'OTHER';
};
export const SIZE_GROUPS = [
  { key: 'LETTER', label: 'Size chữ', hint: 'XS, S, M, L, XL, 2XL...' },
  { key: 'NUMBER', label: 'Size số', hint: '28, 30, 38.5...' },
  { key: 'OTHER', label: 'Khác', hint: 'Free size...' },
];
const letterRank = (name) => {
  const n = normSize(name);
  if (n === 'S') return 2;
  if (n === 'M') return 3;
  if (n === 'L') return 4;
  let m = /^(\d{1,2})XL$/.exec(n);
  if (m) return 4 + Number(m[1]);
  m = /^(X+)L$/.exec(n);
  if (m) return 4 + m[1].length;
  m = /^(X+)S$/.exec(n);
  if (m) return 2 - m[1].length;
  return 0;
};
// Sắp theo nghĩa: chữ (XS < S < M < L < XL < 2XL), số tăng dần, còn lại theo sort_order
export const sortSizes = (rows) => [...rows].sort((a, b) => {
  const ga = sizeGroup(a.name); const gb = sizeGroup(b.name);
  if (ga !== gb) return SIZE_GROUPS.findIndex((g) => g.key === ga) - SIZE_GROUPS.findIndex((g) => g.key === gb);
  if (ga === 'LETTER') return letterRank(a.name) - letterRank(b.name) || a.id - b.id;
  if (ga === 'NUMBER') return parseFloat(normSize(a.name).replace(',', '.')) - parseFloat(normSize(b.name).replace(',', '.')) || a.id - b.id;
  return (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id;
});

// ---- Avatar chữ cái đầu + màu cố định theo tên ----
export const initials = (name) => {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return [...(words.length === 1 ? words[0] : words[words.length - 1])][0].toUpperCase();
};
const AVATAR_COLORS = ['#2e7d32', '#1976d2', '#8e24aa', '#ed8b00', '#00838f', '#c62828', '#5d4037', '#455a64'];
export const avatarColor = (seed) => {
  let h = 0;
  for (const ch of String(seed || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

export const dateOnly = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '');
