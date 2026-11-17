const router = require('express').Router();
const db = require('../../db');
const { wrap, httpError, paging } = require('../../utils');
const { changeOrderStatus, getOrderDetail } = require('../../services/orders');

// ?status=PENDING&q=HT2026&page=1&limit=10
router.get('/', wrap(async (req, res) => {
  const { page, limit, offset } = paging(req.query);
  const where = [];
  const params = [];
  if (req.query.status) { where.push('o.status = ?'); params.push(req.query.status); }
  if (req.query.q) {
    where.push('(o.order_code LIKE ? OR o.recipient_name LIKE ? OR o.recipient_phone LIKE ?)');
    params.push(`%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`);
  }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM orders o ${w}`, params);
  const [rows] = await db.query(
    `SELECT o.id, o.order_code, o.recipient_name, o.recipient_phone, o.total_amount, o.status, o.payment_status,
            o.created_at, u.email AS customer_email
     FROM orders o JOIN users u ON u.id = o.user_id ${w} ORDER BY o.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]);
  res.json({ data: rows, page, limit, total });
}));

router.get('/:id', wrap(async (req, res) => res.json(await getOrderDetail(req.params.id))));

// { status, note, carrier?, tracking_code? }
router.patch('/:id/status', wrap(async (req, res) => {
  const { status, note, carrier, tracking_code } = req.body;
  if (!status) throw httpError(400, 'Thiếu trạng thái');
  await changeOrderStatus(req.params.id, status, req.user.id, note, { carrier, tracking_code });
  res.json(await getOrderDetail(req.params.id));
}));

router.patch('/:id/note', wrap(async (req, res) => {
  await db.query('UPDATE orders SET staff_note = ? WHERE id = ?', [req.body.staff_note || null, req.params.id]);
  res.json({ message: 'Đã lưu ghi chú' });
}));

module.exports = router;
