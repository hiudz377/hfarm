// Đăng ký tài khoản khách ngay trong app (công khai, không cần token). Đăng nhập thì app gọi thẳng token endpoint của Keycloak.
const router = require('express').Router();
const { wrap, httpError } = require('../utils');
const { rateLimit } = require('../middleware/rateLimit');
const kc = require('../services/keycloakAdmin');

// Mặc định 10 lần / 15 phút / IP. REGISTER_RATE_LIMIT_MAX và REGISTER_RATE_LIMIT_WINDOW_MS để đổi (ví dụ khi kiểm thử).
const limiter = rateLimit({
  windowMs: Number(process.env.REGISTER_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.REGISTER_RATE_LIMIT_MAX) || 10,
  message: 'Bạn đã thử đăng ký quá nhiều lần. Vui lòng thử lại sau ít phút.',
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (v) => (typeof v === 'string' ? v.trim() : '');
// Keycloak (user profile mặc định) không nhận các ký tự này trong họ tên; chặn sớm để báo lỗi rõ ràng
const NAME_BAD_CHARS = /[<>&"$%!#?§;*~/\\|^=[\]{}()]/;
const NAME_BAD_MESSAGE = 'Họ tên không được chứa ký tự đặc biệt như < > & " ( ) ; * = ?';

// App hỏi trước để biết có nên hiện form đăng ký trong app hay phải dùng trang đăng ký của Keycloak
router.get('/config', (req, res) => res.json({ registration: kc.isConfigured() }));

// { email, password, full_name } -> 201 { ok: true }. App tự đăng nhập ngay sau đó bằng chính email + mật khẩu này.
router.post('/register', limiter, wrap(async (req, res) => {
  if (!kc.isConfigured()) throw httpError(503, 'Đăng ký trong ứng dụng chưa được bật. Vui lòng liên hệ cửa hàng.');
  const email = clean(req.body?.email).toLowerCase();
  const fullName = clean(req.body?.full_name).replace(/\s+/g, ' ');
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!fullName) throw httpError(400, 'Vui lòng nhập họ tên');
  if (fullName.length > 150) throw httpError(400, 'Họ tên tối đa 150 ký tự');
  if (NAME_BAD_CHARS.test(fullName)) throw httpError(400, NAME_BAD_MESSAGE);
  if (!email || email.length > 190 || !EMAIL.test(email)) throw httpError(400, 'Email không hợp lệ');
  if (password.length < 8) throw httpError(400, 'Mật khẩu cần ít nhất 8 ký tự');
  if (password.length > 128) throw httpError(400, 'Mật khẩu tối đa 128 ký tự');

  try {
    await kc.createCustomer({ email, password, fullName });
  } catch (e) {
    if (!(e instanceof kc.KeycloakAdminError)) throw e;
    if (e.kind === 'exists') throw httpError(409, 'Email này đã được đăng ký. Hãy đăng nhập.');
    if (e.kind === 'invalid') {
      if (e.field === 'firstName' || e.field === 'lastName') throw httpError(400, NAME_BAD_MESSAGE);
      if (e.field === 'email' || e.field === 'username') throw httpError(400, 'Email không hợp lệ');
      // Keycloak kiểm tra chính sách mật khẩu của realm (độ dài, chữ số, ký tự đặc biệt...)
      const policy = /password|mật khẩu/i.test(e.message);
      throw httpError(400, policy ? `Mật khẩu chưa đạt yêu cầu: ${e.message}` : 'Thông tin đăng ký không hợp lệ');
    }
    // network / config: lỗi của hệ thống, không phải của người dùng. Ghi chi tiết ra log, trả thông báo chung.
    console.error('Đăng ký thất bại:', e.message, e.detail || '');
    throw httpError(503, e.kind === 'network'
      ? 'Không kết nối được máy chủ tài khoản. Vui lòng thử lại sau.'
      : 'Đăng ký trong ứng dụng chưa được cấu hình đúng. Vui lòng liên hệ cửa hàng.');
  }
  res.status(201).json({ ok: true });
}));

module.exports = router;
