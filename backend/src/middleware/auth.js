const { createRemoteJWKSet, jwtVerify } = require('jose');
const db = require('../db');
const { httpError } = require('../utils');

const DEV_ROLES = ['admin', 'staff', 'customer'];

let JWKS;
const getJwks = () =>
  (JWKS ||= createRemoteJWKSet(
    new URL(`${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/certs`)
  ));

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
      if (e.code !== 'ER_DUP_ENTRY') throw e; // 2 request cùng lúc: bỏ qua
    }
    user = await find();
  } else {
    await db.query('UPDATE users SET user_type = ? WHERE id = ?', [userType, user.id]);
  }
  if (!user) throw httpError(500, 'Không tạo được tài khoản');
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
        const issuer = `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}`;
        ({ payload } = await jwtVerify(token, getJwks(), { issuer }));
      } catch {
        throw httpError(401, 'Token không hợp lệ hoặc đã hết hạn');
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

module.exports = { authenticate, requireRole };
