const router = require('express').Router();
const db = require('../../db');
const { wrap, httpError, paging } = require('../../utils');
const {
  changeOrderStatus, getOrderDetail, bulkOrderAction, orderCounts, TRANSITIONS,
} = require('../../services/orders');
const { getGift } = require('../../services/giftOrders');
const { confirmPaymentManually } = require('../../services/payments');
const { listEvents, addEvent, deleteEvent } = require('../../services/tracking');

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
  // &gift=1 chỉ đơn quà tặng, &gift=wrap chỉ đơn quà có gói hộp (nhân viên cần gói)
  if (req.query.gift === '1') where.push('g.order_id IS NOT NULL');
  else if (req.query.gift === 'wrap') where.push('g.wrap = 1');
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const from = `FROM orders o JOIN users u ON u.id = o.user_id LEFT JOIN shipments s ON s.order_id = o.id
                LEFT JOIN order_gifts g ON g.order_id = o.id`;
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${from} ${w}`, params);
  const [rows] = await db.query(
    `SELECT o.id, o.order_code, o.recipient_name, o.recipient_phone, o.total_amount, o.status, o.payment_status,
            o.created_at, u.email AS customer_email, s.carrier, s.tracking_code,
            (g.order_id IS NOT NULL) AS is_gift, COALESCE(g.wrap, 0) AS gift_wrap,
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

// Chi tiết đơn kèm hạn thanh toán (đơn chuyển khoản) và hành trình do nhân viên ghi
router.get('/:id', wrap(async (req, res) => {
  const detail = await getOrderDetail(req.params.id);
  // gift: thiệp + ẩn giá + gói quà (null nếu không phải đơn quà); card là mẫu thiệp đầy đủ để CMS in
  res.json({ ...detail, shipment_events: await listEvents(detail.id), gift: await getGift(detail.id) });
}));

// Nhân viên xác nhận đã nhận tiền chuyển khoản: { transaction_code?, note? }
router.post('/:id/confirm-payment', wrap(async (req, res) => {
  await confirmPaymentManually(req.params.id, req.user.id, req.body || {});
  res.json(await getOrderDetail(req.params.id));
}));

// Ghi mốc hành trình khi đơn đang giao: { title, location? }
router.post('/:id/shipment-events', wrap(async (req, res) => {
  const r = await addEvent(req.params.id, req.user.id, req.body || {});
  res.status(201).json(r);
}));
router.delete('/:id/shipment-events/:eventId', wrap(async (req, res) => {
  await deleteEvent(req.params.id, req.params.eventId);
  res.json({ message: 'Đã xóa' });
}));

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
