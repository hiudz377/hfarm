const { createRemoteJWKSet, jwtVerify } = require('jose');
const db = require('../db');
const { httpError } = require('../utils');

const DEV_ROLES = ['admin', 'staff', 'customer'];

// Bỏ dấu "/" thừa ở cuối để issuer khớp chính xác với claim "iss" của Keycloak
const issuerUrl = () => `${String(process.env.KEYCLOAK_URL).replace(/\/+$/, '')}/realms/${process.env.KEYCLOAK_REALM}`;

// Gọi lúc khởi động: thiếu cấu hình thì dừng ngay với thông báo rõ ràng, thay vì để mọi request
// bị trả 401 "Token không hợp lệ" mà không biết nguyên nhân.
function assertAuthConfig() {
  if (process.env.AUTH_ENABLED !== 'true') return;
  const missing = ['KEYCLOAK_URL', 'KEYCLOAK_REALM'].filter((k) => !String(process.env[k] || '').trim());
  if (missing.length) throw new Error(`AUTH_ENABLED=true nhưng thiếu biến môi trường: ${missing.join(', ')}`);
}

let JWKS;
const getJwks = () => (JWKS ||= createRemoteJWKSet(new URL(`${issuerUrl()}/protocol/openid-connect/certs`)));

// Lỗi do chính token (hết hạn, sai chữ ký, sai issuer, sai định dạng...) -> 401.
// Lỗi còn lại (Keycloak không truy cập được, JWKS hỏng) không phải lỗi của người dùng -> 503,
// để web không tưởng nhầm là hết phiên rồi chuyển sang đăng nhập lại liên tục.
const isTokenError = (e) =>
  /^ERR_(JWT_|JWS_|JOSE_ALG_NOT_ALLOWED|JOSE_NOT_SUPPORTED|JWKS_NO_MATCHING_KEY)/.test(String(e?.code));

// Đồng bộ tài khoản Keycloak sang bảng users, trả về id nội bộ
async function syncUser({ sub, email, name, roles }) {
  const userType = roles.includes('admin') ? 'ADMIN' : roles.includes('staff') ? 'STAFF' : 'CUSTOMER';
  const find = async () => (await db.query('SELECT id, status FROM users WHERE keycloak_id = ?', [sub]))[0][0];

  let user = await find();
  if (!user) {
    try {
      await db.query(
        'INSERT INTO users (keycloak_id, email, full_name, user_type) VALUES (?,?,?,?)',
        [sub, email || `${sub}@no-email.local`, name || null, userType]
      );
    } catch (e) {
      if (e.code !== 'ER_DUP_ENTRY') throw e;
    }
    // Trùng keycloak_id = 2 request cùng lúc đã tạo giúp: dùng luôn. Nếu vẫn không thấy thì email
    // đã thuộc về một tài khoản khác (uq_users_email); không tự gộp vì email Keycloak có thể chưa xác minh.
    user = await find();
    if (!user) throw httpError(409, 'Email của tài khoản này đã được dùng bởi một tài khoản khác trong hệ thống');
  } else {
    await db.query('UPDATE users SET user_type = ? WHERE id = ?', [userType, user.id]);
  }
  if (user.status !== 'ACTIVE') throw httpError(403, 'Tài khoản đã bị khóa');
  return user.id;
}

// Gắn req.user = { id, sub, name, email, roles }
async function authenticate(req, res, next) {
  try {
    let claims;
    if (process.env.AUTH_ENABLED !== 'true') {
      // Chế độ dev: chưa cần Keycloak. Header X-Dev-Role (admin|staff|customer) chọn vai trò cho từng
      // request, để web CMS (admin) và mobile (customer) chạy cùng lúc. Giá trị lạ -> dùng DEV_ROLE.
      // Khi AUTH_ENABLED=true nhánh này không chạy nên header bị bỏ qua hoàn toàn.
      const headerRole = String(req.headers['x-dev-role'] || '').toLowerCase();
      const role = DEV_ROLES.includes(headerRole) ? headerRole : process.env.DEV_ROLE || 'admin';
      claims = {
        sub: `dev-${role}`,
        email: `${role}@htbanqa.local`,
        name: `Dev ${role}`,
        roles: [role],
      };
    } else {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (!token) throw httpError(401, 'Chưa đăng nhập');
      let payload;
      try {
        ({ payload } = await jwtVerify(token, getJwks(), { issuer: issuerUrl() }));
      } catch (e) {
        if (isTokenError(e)) throw httpError(401, 'Token không hợp lệ hoặc đã hết hạn');
        console.error('Không xác thực được token với Keycloak:', e.message);
        throw httpError(503, 'Không kết nối được máy chủ xác thực (Keycloak)');
      }
      claims = {
        sub: payload.sub,
        email: payload.email,
        name: payload.name || payload.preferred_username,
        roles: payload.realm_access?.roles || [],
      };
    }
    const id = await syncUser(claims);
    req.user = { id, ...claims };
    next();
  } catch (e) {
    next(e);
  }
}

const requireRole = (...roles) => (req, res, next) =>
  req.user.roles.some((r) => roles.includes(r)) ? next() : next(httpError(403, 'Không đủ quyền'));

module.exports = { authenticate, requireRole, assertAuthConfig };
