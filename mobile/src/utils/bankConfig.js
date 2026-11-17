// Thông tin chuyển khoản GIẢ ĐỊNH, chỉ để minh họa giao diện.
// Backend chưa lưu tài khoản ngân hàng của cửa hàng; trước khi phát hành hãy thay bằng thông tin thật
// (hoặc chuyển sang lấy từ API khi backend có).
export const BANK_TRANSFER = {
  bankName: 'Vietcombank (VCB)',
  accountNumber: '0123456789',
  accountName: 'CONG TY TNHH HFARM',
  branch: 'Chi nhánh TP. Hồ Chí Minh',
  // Nội dung chuyển khoản = `${contentPrefix} ${mã đơn}`
  contentPrefix: 'HFARM',
};

export const transferContent = (orderCode) =>
  orderCode ? `${BANK_TRANSFER.contentPrefix} ${orderCode}` : `${BANK_TRANSFER.contentPrefix} + mã đơn hàng`;
