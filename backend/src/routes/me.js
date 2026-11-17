// Hồ sơ và địa chỉ của chính người đăng nhập
const router = require('express').Router();
const db = require('../db');
const { wrap, httpError, pick, tx } = require('../utils');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', wrap(async (req, res) => {
  const [rows] = await db.query(
    'SELECT id, email, full_name, phone, avatar_url, user_type, created_at FROM users WHERE id = ?', [req.user.id]);
  res.json({ ...rows[0], roles: req.user.roles });
}));

router.put('/', wrap(async (req, res) => {
  const data = pick(req.body, ['full_name', 'phone', 'avatar_url']);
  if (!Object.keys(data).length) throw httpError(400, 'Không có dữ liệu để cập nhật');
  await db.query('UPDATE users SET ? WHERE id = ?', [data, req.user.id]);
  res.json({ message: 'Đã cập nhật' });
}));

// ---- Địa chỉ ----
const ADDR = ['recipient_name', 'phone', 'province', 'district', 'ward', 'address_detail', 'is_default'];

router.get('/addresses', wrap(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC', [req.user.id]);
  res.json(rows);
}));

router.post('/addresses', wrap(async (req, res) => {
  const data = pick(req.body, ADDR);
  for (const k of ['recipient_name', 'phone', 'province', 'district', 'ward', 'address_detail'])
    if (!data[k]) throw httpError(400, `Thiếu ${k}`);
  const id = await tx(async (conn) => {
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?', [req.user.id]);
    if (n === 0) data.is_default = true; // địa chỉ đầu tiên luôn là mặc định
    if (data.is_default) await conn.query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    const [r] = await conn.query('INSERT INTO addresses SET ?', [{ ...data, user_id: req.user.id }]);
    return r.insertId;
  });
  res.status(201).json({ id });
}));

router.put('/addresses/:id', wrap(async (req, res) => {
  const data = pick(req.body, ADDR);
  if (!Object.keys(data).length) throw httpError(400, 'Không có dữ liệu để cập nhật');
  await tx(async (conn) => {
    if (data.is_default) await conn.query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    const [r] = await conn.query('UPDATE addresses SET ? WHERE id = ? AND user_id = ?', [data, req.params.id, req.user.id]);
    if (!r.affectedRows) throw httpError(404, 'Không tìm thấy địa chỉ');
  });
  res.json({ message: 'Đã cập nhật' });
}));

router.delete('/addresses/:id', wrap(async (req, res) => {
  await db.query('DELETE FROM addresses WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ message: 'Đã xóa' });
}));

module.exports = router;
