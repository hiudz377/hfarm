// Duyệt đánh giá (admin và staff)
const router = require('express').Router();
const db = require('../../db');
const { wrap, httpError, paging } = require('../../utils');
const { REVIEW_STATUSES } = require('../../services/reviews');

const MAX_BULK = 100;

// ?status=PENDING|APPROVED|REJECTED &rating=1..5 &q=sản phẩm / người đánh giá / nội dung &page=1&limit=20
router.get('/', wrap(async (req, res) => {
  const { page, limit, offset } = paging(req.query);
  const where = [];
  const params = [];
  if (req.query.status) {
    if (!REVIEW_STATUSES.includes(req.query.status)) throw httpError(400, `Trạng thái đánh giá không hợp lệ: ${req.query.status}`);
    where.push('r.status = ?'); params.push(req.query.status);
  }
  if (req.query.rating) {
    const rating = Number(req.query.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw httpError(400, 'Số sao lọc phải từ 1 đến 5');
    where.push('r.rating = ?'); params.push(rating);
  }
  if (req.query.q) {
    where.push('(p.name LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR r.comment LIKE ?)');
    const like = `%${req.query.q}%`;
    params.push(like, like, like, like);
  }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const from = 'FROM reviews r JOIN products p ON p.id = r.product_id JOIN users u ON u.id = r.user_id';
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${from} ${w}`, params);
  const [rows] = await db.query(
    `SELECT r.id, r.rating, r.comment, r.status, r.created_at, r.product_id, p.name AS product_name,
            (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, sort_order, id LIMIT 1) AS thumbnail,
            u.full_name AS user_name, u.email AS user_email,
            (SELECT o.order_code FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = r.order_item_id) AS order_code
     ${from} ${w} ORDER BY r.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]);
  res.json({ data: rows, page, limit, total });
}));

// Số đánh giá theo trạng thái: { PENDING, APPROVED, REJECTED }
router.get('/counts', wrap(async (req, res) => {
  const [rows] = await db.query('SELECT status, COUNT(*) AS n FROM reviews GROUP BY status');
  const counts = Object.fromEntries(REVIEW_STATUSES.map((s) => [s, 0]));
  for (const r of rows) counts[r.status] = Number(r.n);
  res.json(counts);
}));

// { ids: [1, 2], status: 'APPROVED' | 'REJECTED' | 'PENDING' } (tối đa 100). REJECTED = ẩn khỏi cửa hàng.
router.post('/bulk-status', wrap(async (req, res) => {
  const { ids, status } = req.body || {};
  if (!REVIEW_STATUSES.includes(status)) throw httpError(400, 'Trạng thái không hợp lệ');
  if (!Array.isArray(ids) || !ids.length) throw httpError(400, 'Chưa chọn đánh giá nào');
  const list = [...new Set(ids.map((v) => (typeof v === 'number' || /^\d+$/.test(String(v)) ? Number(v) : NaN)))];
  if (list.some((id) => !Number.isSafeInteger(id) || id < 1)) throw httpError(400, 'Mã đánh giá không hợp lệ');
  if (list.length > MAX_BULK) throw httpError(400, `Chỉ xử lý tối đa ${MAX_BULK} đánh giá mỗi lần`);
  const [r] = await db.query('UPDATE reviews SET status = ? WHERE id IN (?)', [status, list]);
  res.json({ updated: r.affectedRows, requested: list.length });
}));

router.delete('/:id', wrap(async (req, res) => {
  const [r] = await db.query('DELETE FROM reviews WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) throw httpError(404, 'Không tìm thấy đánh giá');
  res.json({ message: 'Đã xóa' });
}));

module.exports = router;
