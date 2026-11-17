// Tất cả route /api/admin/* (đã được bảo vệ bằng role admin/staff ở backend/index.js)
const router = require('express').Router();
const db = require('../../db');
const { wrap } = require('../../utils');
const { requireRole } = require('../../middleware/auth');

const APP_ROLES = ['admin', 'staff', 'customer'];
const adminOnly = requireRole('admin');
// Staff được ĐỌC danh mục/thương hiệu/size/màu (form sản phẩm cần), nhưng chỉ admin được thêm/sửa/xóa
const writeAdminOnly = (req, res, next) =>
  ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? next() : adminOnly(req, res, next);

// Người đang đăng nhập (staff cũng dùng được)
router.get('/me', wrap(async (req, res) => {
  const [[row]] = await db.query('SELECT email, full_name FROM users WHERE id = ?', [req.user.id]);
  res.json({
    id: req.user.id,
    email: row?.email ?? req.user.email ?? null,
    full_name: row?.full_name ?? req.user.name ?? null,
    roles: req.user.roles.filter((r) => APP_ROLES.includes(r)),
  });
}));

// Phân quyền: staff dùng được Đơn hàng, Sản phẩm, Kho (và Tổng quan, upload ảnh).
// Chỉ admin: Khách hàng, Mã giảm giá, và thao tác ghi của Danh mục / Thương hiệu / Size / Màu.
router.use('/users', adminOnly);
router.use('/coupons', adminOnly);
router.use(['/categories', '/brands', '/sizes', '/colors'], writeAdminOnly);

router.use(require('./attributes'));
router.use(require('./upload'));
router.use('/products', require('./products'));
router.use('/inventory', require('./inventory'));
router.use('/orders', require('./orders'));
router.use(require('./misc'));

module.exports = router;
