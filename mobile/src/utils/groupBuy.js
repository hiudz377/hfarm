// Tính toán + định dạng cho Mua nhóm (không phụ thuộc React) - dùng ở thẻ ở trang sản phẩm, màn nhóm và danh sách nhóm.
// groupPrice phải GIỐNG HỆT backend/src/services/groupBuy.js (làm tròn tới đồng) để giá hiện trước khi vào nhóm khớp giá thật.

export const groupPrice = (price, percent) => Math.round((Number(price) * (100 - Number(percent))) / 100);

// "3 người giảm 10%" -> dùng cho dòng bậc giá
export const tierText = (t) => `Đủ ${t.min_members} người giảm ${t.discount_percent}%`;

// 93784 giây -> "1 ngày 2 giờ"; 7500 -> "2 giờ 5 phút"; 750 -> "12 phút 30 giây"; <= 0 -> "0 giây"
export function durationText(totalSeconds) {
  const s = Math.max(Math.floor(Number(totalSeconds) || 0), 0);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return h > 0 ? `${d} ngày ${h} giờ` : `${d} ngày`;
  if (h > 0) return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`;
  if (m > 0) return `${m} phút ${s % 60} giây`;
  return `${s} giây`;
}

// Chuẩn hóa mã khách gõ tay ("abcd-2efg" -> "ABCD2EFG"); sai định dạng -> null. Bộ ký tự giống backend (bỏ I, O, 0, 1).
const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;
export function normalizeGroupCode(input) {
  const s = String(input ?? '').toUpperCase().replace(/[\s-]+/g, '');
  return CODE_RE.test(s) ? s : null;
}

// Mã nhóm hiện cho dễ đọc: ABCD2EFG -> "ABCD 2EFG"
export const prettyCode = (code) => `${String(code).slice(0, 4)} ${String(code).slice(4)}`;

// Lời mời gửi bạn bè (Share): có link http (bấm được trong Zalo/Messenger), link mở app và mã để nhập tay
export function inviteMessage(group) {
  const { product, tiers, share } = group;
  const ladder = tiers.map((t) => `${t.min_members} người giảm ${t.discount_percent}%`).join(', ');
  return [
    `Mua nhóm "${product.name}" cùng mình nhé! Càng đông càng rẻ: ${ladder}.`,
    `Tham gia: ${share.url}`,
    `Hoặc mở ứng dụng HFarm > Tài khoản > Mua nhóm của tôi và nhập mã ${prettyCode(share.code)}.`,
  ].join('\n');
}

// Nhãn trạng thái nhóm (màu theo mức)
export const STATUS_LABEL = {
  OPEN: { text: 'Đang mở', tone: 'primary' },
  SUCCESS: { text: 'Đã chốt', tone: 'success' },
  FAILED: { text: 'Chưa đủ người', tone: 'muted' },
  CANCELLED: { text: 'Đã hủy', tone: 'muted' },
};

// Trạng thái mua của chính mình (claim) -> chữ hiển thị ở danh sách nhóm
export const CLAIM_LABEL = {
  WAIT: 'Đang rủ bạn',
  CAN_CLAIM: 'Đến lượt mua giá nhóm',
  CLAIMED: 'Đã mua',
  EXPIRED: 'Hết hạn mua',
  NONE: '',
};
