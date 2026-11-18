// Sản phẩm yêu thích của người đăng nhập
const router = require('express').Router();
const db = require('../db');
const { wrap, httpError, paging } = require('../utils');
const { authenticate } = require('../middleware/auth');
const { LIST_COLUMNS } = require('../services/products');

router.use(authenticate);

const productId = (req) => {
  const id = Number(req.params.productId);
  if (!Number.isSafeInteger(id) || id < 1) throw httpError(400, 'Mã sản phẩm không hợp lệ');
  return id;
};

// Danh sách id đã thích (nhẹ): mobile dùng để tô trái tim trên mọi thẻ sản phẩm
router.get('/ids', wrap(async (req, res) => {
  const [rows] = await db.query('SELECT product_id FROM favorites WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
  res.json(rows.map((r) => r.product_id));
}));

// ?page=1&limit=12: sản phẩm đang bán mà người dùng đã thích, mới thích trước (sản phẩm bị ẩn thì không hiện)
router.get('/', wrap(async (req, res) => {
  const { page, limit, offset } = paging(req.query);
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM favorites f JOIN products p ON p.id = f.product_id AND p.status = 'ACTIVE'
     WHERE f.user_id = ?`, [req.user.id]);
  const [rows] = await db.query(
    `SELECT ${LIST_COLUMNS}, f.created_at AS favorited_at
     FROM favorites f
     JOIN products p ON p.id = f.product_id AND p.status = 'ACTIVE'
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN brands b ON b.id = p.brand_id
     WHERE f.user_id = ? ORDER BY f.id DESC LIMIT ? OFFSET ?`,
    [req.user.id, limit, offset]);
  res.json({ data: rows, page, limit, total });
}));

// Thích (lặp lại nhiều lần vẫn chỉ một dòng)
router.put('/:productId', wrap(async (req, res) => {
  const id = productId(req);
  const [p] = await db.query("SELECT id FROM products WHERE id = ? AND status = 'ACTIVE'", [id]);
  if (!p.length) throw httpError(404, 'Sản phẩm không còn bán');
  await db.query('INSERT IGNORE INTO favorites (user_id, product_id) VALUES (?,?)', [req.user.id, id]);
  res.json({ product_id: id, favorited: true });
}));

// Bỏ thích (chưa thích thì cũng không lỗi)
router.delete('/:productId', wrap(async (req, res) => {
  const id = productId(req);
  await db.query('DELETE FROM favorites WHERE user_id = ? AND product_id = ?', [req.user.id, id]);
  res.json({ product_id: id, favorited: false });
}));

module.exports = router;
