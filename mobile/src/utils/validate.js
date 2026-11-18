// Kiểm tra dữ liệu địa chỉ giao hàng TRƯỚC khi gửi lên backend (backend chỉ kiểm tra "có/không").

// Chuẩn hóa số điện thoại VN: bỏ khoảng trắng . - ( ) và đổi +84 / 84 thành 0
export function normalizePhone(raw) {
  let s = String(raw ?? '').replace(/[\s.\-()]/g, '');
  if (s.startsWith('+84')) s = `0${s.slice(3)}`;
  else if (/^84\d{9}$/.test(s)) s = `0${s.slice(2)}`;
  return s;
}

// Số di động VN: 10 số, đầu 03x / 05x / 07x / 08x / 09x
export const isValidVnPhone = (raw) => /^0[35789]\d{8}$/.test(normalizePhone(raw));

// ---- Đăng nhập / đăng ký (khớp với kiểm tra ở backend/src/routes/auth.js) ----
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Keycloak không nhận các ký tự này trong họ tên
const NAME_BAD_CHARS = /[<>&"$%!#?§;*~/\\|^=[\]{}()]/;

export const isValidEmail = (value) => {
  const s = String(value ?? '').trim();
  return s.length > 0 && s.length <= 190 && EMAIL_RE.test(s);
};

export function validateSignIn({ email, password }) {
  const errors = {};
  if (!String(email ?? '').trim()) errors.email = 'Vui lòng nhập email';
  else if (!isValidEmail(email)) errors.email = 'Email không hợp lệ';
  if (!password) errors.password = 'Vui lòng nhập mật khẩu';
  return errors;
}

export function validateSignUp({ fullName, email, password, confirm }) {
  const errors = {};
  const name = String(fullName ?? '').trim().replace(/\s+/g, ' ');
  if (!name) errors.fullName = 'Vui lòng nhập họ tên';
  else if (name.length > 150) errors.fullName = 'Họ tên tối đa 150 ký tự';
  else if (NAME_BAD_CHARS.test(name)) errors.fullName = 'Họ tên không được chứa ký tự đặc biệt như < > & " ( ) ; * = ?';
  if (!String(email ?? '').trim()) errors.email = 'Vui lòng nhập email';
  else if (!isValidEmail(email)) errors.email = 'Email không hợp lệ';
  const pw = String(password ?? '');
  if (!pw) errors.password = 'Vui lòng nhập mật khẩu';
  else if (pw.length < 8) errors.password = 'Mật khẩu cần ít nhất 8 ký tự';
  else if (pw.length > 128) errors.password = 'Mật khẩu tối đa 128 ký tự';
  if (!errors.password && pw !== String(confirm ?? '')) errors.confirm = 'Mật khẩu nhập lại không khớp';
  return errors;
}

export const ADDRESS_FIELDS =['recipient_name', 'phone', 'province', 'district', 'ward', 'address_detail'];

// Độ dài tối đa theo cột trong database/schema.sql (addresses)
const MAX = { recipient_name: 150, province: 100, district: 100, ward: 100, address_detail: 255 };

const LABELS = {
  recipient_name: 'Họ tên người nhận',
  province: 'Tỉnh / Thành phố',
  district: 'Quận / Huyện',
  ward: 'Phường / Xã',
  address_detail: 'Địa chỉ chi tiết (số nhà, đường)',
};

// Trả về { tên_trường: 'thông báo lỗi tiếng Việt' }; object rỗng = hợp lệ
export function validateAddress(values) {
  const errors = {};
  for (const key of ['recipient_name', 'province', 'district', 'ward', 'address_detail']) {
    const v = String(values[key] ?? '').trim();
    if (!v) errors[key] = `Vui lòng nhập ${LABELS[key].toLowerCase()}`;
    else if (v.length > MAX[key]) errors[key] = `${LABELS[key]} tối đa ${MAX[key]} ký tự`;
  }
  if (!errors.recipient_name && String(values.recipient_name).trim().length < 2) {
    errors.recipient_name = 'Họ tên quá ngắn';
  }
  const phone = String(values.phone ?? '').trim();
  if (!phone) errors.phone = 'Vui lòng nhập số điện thoại';
  else if (!isValidVnPhone(phone)) errors.phone = 'Số điện thoại không hợp lệ (ví dụ 0912345678 hoặc +84912345678)';
  return errors;
}

// Hồ sơ cá nhân: họ tên bắt buộc (2-150 ký tự); số điện thoại KHÔNG bắt buộc nhưng đã nhập thì phải hợp lệ
export function validateProfile(values) {
  const errors = {};
  const name = String(values.full_name ?? '').trim();
  if (!name) errors.full_name = 'Vui lòng nhập họ tên';
  else if (name.length < 2) errors.full_name = 'Họ tên quá ngắn';
  else if (name.length > 150) errors.full_name = 'Họ tên tối đa 150 ký tự';
  const phone = String(values.phone ?? '').trim();
  if (phone && !isValidVnPhone(phone)) errors.phone = 'Số điện thoại không hợp lệ (ví dụ 0912345678 hoặc +84912345678)';
  return errors;
}

// Số điện thoại bỏ trống -> null (xóa số điện thoại)
export const cleanProfile = (values) => ({
  full_name: String(values.full_name ?? '').trim().replace(/\s+/g, ' '),
  phone: String(values.phone ?? '').trim() ? normalizePhone(values.phone) : null,
});

// Dữ liệu sạch để gửi lên: cắt khoảng trắng thừa, số điện thoại về dạng 0xxxxxxxxx
export function cleanAddress(values) {
  const out = {};
  for (const key of ADDRESS_FIELDS) out[key] = String(values[key] ?? '').trim().replace(/\s+/g, ' ');
  out.phone = normalizePhone(values.phone);
  return out;
}
