// Đơn hàng của khách (mobile)
const router = require('express').Router();
const db = require('../db');
const { wrap, paging, httpError } = require('../utils');
const { authenticate } = require('../middleware/auth');
const { createOrder, quoteOrder, changeOrderStatus, getOrderDetail, TRANSITIONS } = require('../services/orders');
const { getGift } = require('../services/giftOrders');
const { getPaymentInfo } = require('../services/payments');
const { getOrderTracking } = require('../services/tracking');

router.use(authenticate);

// Xem trước tiền (tạm tính, giảm giá, phí ship, tổng): body { items?, coupon_code, address_id? }. Không ghi DB.
// Có address_id thì phí ship theo vùng của địa chỉ đó; kèm shipping_zone { zone_name, eta_min_days, eta_max_days, free_over }.
router.post('/quote', wrap(async (req, res) => res.json(await quoteOrder(req.user.id, req.body))));

router.post('/', wrap(async (req, res) => res.status(201).json(await createOrder(req.user.id, req.body))));

// ?status=PENDING hoặc nhiều trạng thái cách nhau dấu phẩy (?status=CONFIRMED,PROCESSING,SHIPPING); &page=&limit=
// Mỗi đơn trả thêm item_count (số dòng hàng) và first_product_name (tên sản phẩm đầu tiên).
router.get('/', wrap(async (req, res) => {
  const { limit, offset } = paging(req.query);
  const where = ['o.user_id = ?'];
  const params = [req.user.id];
  const statuses = String(req.query.status || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (statuses.length) {
    const bad = statuses.find((s) => !Object.hasOwn(TRANSITIONS, s));
    if (bad) throw httpError(400, `Trạng thái đơn hàng không hợp lệ: ${bad}`);
    where.push('o.status IN (?)');
    params.push(statuses);
  }
  const [rows] = await db.query(
    `SELECT o.id, o.order_code, o.total_amount, o.status, o.payment_status, o.created_at,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
            (SELECT oi.product_name FROM order_items oi WHERE oi.order_id = o.id ORDER BY oi.id LIMIT 1) AS first_product_name
     FROM orders o WHERE ${where.join(' AND ')} ORDER BY o.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]);
  res.json(rows);
}));

// Kèm gift (thiệp, ẩn giá, gói quà) nếu là đơn quà tặng, không thì gift = null
router.get('/:id', wrap(async (req, res) => {
  const detail = await getOrderDetail(req.params.id, req.user.id);
  res.json({ ...detail, gift: await getGift(detail.id) });
}));

// Thông tin để chuyển khoản đơn này: mã VietQR (ảnh PNG dạng data URL + chuỗi gốc), số tài khoản, nội dung, số giây còn lại.
// Hết hạn / đã trả / đã hủy thì payable = false và không có mã QR. Chỉ dùng cho đơn chọn chuyển khoản.
router.get('/:id/payment', wrap(async (req, res) => res.json(await getPaymentInfo(req.params.id, req.user.id))));

// Hành trình giao hàng (mới nhất trước): các mốc đổi trạng thái + mốc nhân viên ghi + mốc đã nhận tiền
router.get('/:id/tracking', wrap(async (req, res) => res.json(await getOrderTracking(req.params.id, req.user.id))));

// Khách chỉ được hủy đơn khi còn PENDING (changeOrderStatus tự kiểm tra bước chuyển)
router.post('/:id/cancel', wrap(async (req, res) => {
  const detail = await getOrderDetail(req.params.id, req.user.id);
  if (detail.status !== 'PENDING') return res.status(400).json({ error: 'Chỉ hủy được đơn đang chờ xác nhận' });
  await changeOrderStatus(detail.id, 'CANCELLED', req.user.id, req.body.note || 'Khách hủy đơn', { ownerOnlyUserId: req.user.id });
  res.json({ message: 'Đã hủy đơn' });
}));

module.exports = router;
