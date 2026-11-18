// Đổi lỗi OAuth của Keycloak khi đăng nhập bằng email + mật khẩu sang tiếng Việt. Không import gì để kiểm tra riêng được.
// code: trường `error` (ví dụ invalid_grant), description: trường `error_description` (tiếng Anh, tùy phiên bản Keycloak).

// Lỗi này là do CẤU HÌNH (client chưa bật Direct access grants...), không phải do người dùng nhập sai
export const isConfigErrorCode = (code) => code === 'unauthorized_client' || code === 'invalid_client';

export function passwordGrantMessage(code, description) {
  if (code !== 'invalid_grant') return null;
  const d = String(description ?? '').toLowerCase();
  if (d.includes('account disabled')) return 'Tài khoản đã bị khóa. Vui lòng liên hệ cửa hàng.';
  if (d.includes('temporarily disabled')) return 'Tài khoản tạm khóa do nhập sai nhiều lần. Hãy thử lại sau ít phút.';
  if (d.includes('not fully set up')) return 'Tài khoản cần hoàn tất thiết lập (ví dụ xác minh email) trước khi đăng nhập.';
  // "Invalid user credentials" và mọi trường hợp còn lại: không nói rõ sai email hay sai mật khẩu (tránh lộ email nào đã đăng ký)
  return 'Email hoặc mật khẩu không đúng.';
}
