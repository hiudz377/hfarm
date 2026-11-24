// Cấu hình thanh toán đọc từ biến môi trường (KHÔNG ghi số tài khoản thật vào code: kho GitHub là công khai).
// Đọc mỗi lần gọi (không cache) để đổi .env + restart là đủ và test đổi được biến.

// Tài khoản nhận tiền của cửa hàng. configured = false thì tắt chuyển khoản (app không hiện lựa chọn, backend từ chối đặt).
function bankConfig() {
  const bin = (process.env.BANK_BIN || '').trim();
  const accountNo = (process.env.BANK_ACCOUNT_NO || '').trim();
  const accountName = (process.env.BANK_ACCOUNT_NAME || '').trim();
  const bankName = (process.env.BANK_NAME || '').trim();
  const configured = /^\d{6}$/.test(bin) && /^[0-9A-Za-z]{3,19}$/.test(accountNo) && accountName.length > 0;
  return { configured, bin, accountNo, accountName, bankName: bankName || `Ngân hàng ${bin}` };
}

// Số phút giữ đơn chuyển khoản chưa trả (quá hạn: tự hủy + hoàn kho). Mặc định 24 giờ, tối thiểu 5 phút.
function holdMinutes() {
  const n = parseInt(process.env.PAYMENT_HOLD_MINUTES, 10);
  return Number.isFinite(n) && n >= 5 ? Math.min(n, 60 * 24 * 7) : 24 * 60;
}

// Khóa bí mật webhook ngân hàng (SePay/Casso gửi kèm header Authorization: Apikey <khóa>). Trống = tắt webhook.
const webhookKey = () => (process.env.PAYMENT_WEBHOOK_KEY || '').trim();

module.exports = { bankConfig, holdMinutes, webhookKey };
