const router = require('express').Router();
const db = require('../../db');
const { wrap, httpError, paging } = require('../../utils');
const {
  changeOrderStatus, getOrderDetail, bulkOrderAction, orderCounts, TRANSITIONS,
} = require('../../services/orders');

const PAYMENT_STATUSES = ['UNPAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED'];

// ?status=PENDING hoặc nhiều trạng thái cách nhau dấu phẩy (CONFIRMED,PROCESSING) &payment_status=UNPAID
// &q=mã đơn / tên / SĐT / mã vận đơn &page=1&limit=20
router.get('/', wrap(async (req, res) => {
  const { page, limit, offset } = paging(req.query);
  const where = [];
  const params = [];
  const statuses = String(req.query.status || '').split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = statuses.find((s) => !Object.hasOwn(TRANSITIONS, s));
  if (unknown) throw httpError(400, `Trạng thái đơn hàng không hợp lệ: ${unknown}`);
  if (statuses.length) { where.push(`o.status IN (${statuses.map(() => '?').join(',')})`); params.push(...statuses); }
  if (req.query.payment_status) {
    if (!PAYMENT_STATUSES.includes(req.query.payment_status)) throw httpError(400, `Trạng thái thanh toán không hợp lệ: ${req.query.payment_status}`);
    where.push('o.payment_status = ?');
    params.push(req.query.payment_status);
  }
  if (req.query.q) {
    where.push('(o.order_code LIKE ? OR o.recipient_name LIKE ? OR o.recipient_phone LIKE ? OR s.tracking_code LIKE ?)');
    const like = `%${req.query.q}%`;
    params.push(like, like, like, like);
  }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const from = 'FROM orders o JOIN users u ON u.id = o.user_id LEFT JOIN shipments s ON s.order_id = o.id';
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${from} ${w}`, params);
  const [rows] = await db.query(
    `SELECT o.id, o.order_code, o.recipient_name, o.recipient_phone, o.total_amount, o.status, o.payment_status,
            o.created_at, u.email AS customer_email, s.carrier, s.tracking_code,
            (SELECT payment_method FROM payments WHERE order_id = o.id ORDER BY id LIMIT 1) AS payment_method
     ${from} ${w} ORDER BY o.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]);
  res.json({ data: rows, page, limit, total });
}));

// Số đơn theo từng trạng thái: { PENDING: 3, CONFIRMED: 0, ... }
router.get('/counts', wrap(async (req, res) => res.json(await orderCounts())));

// Xử lý một hoặc nhiều đơn theo "bước tiếp theo": { ids: [1,2], action: confirm|ship|complete|cancel|return, note?, carrier?, tracking_code? }
//   confirm: Chờ xác nhận -> Đã xác nhận        ship: Đã xác nhận/Đang xử lý -> Đang giao (tự tạo mã vận đơn nếu không nhập)
//   complete: Đang giao -> Hoàn thành           cancel: -> Đã hủy (hoàn kho)       return: Đang giao/Hoàn thành -> Hoàn trả (hoàn kho)
// Đơn nào không hợp lệ thì báo lỗi riêng trong results, các đơn còn lại vẫn được xử lý.
router.post('/bulk', wrap(async (req, res) => {
  const { ids, action, note, carrier, tracking_code } = req.body || {};
  res.json(await bulkOrderAction(ids, action, req.user.id, { note, carrier, tracking_code }));
}));

router.get('/:id', wrap(async (req, res) => res.json(await getOrderDetail(req.params.id))));

// { status, note, carrier?, tracking_code? } (đổi đúng một bước; CMS dùng POST /bulk)
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
