// Thống kê, khách hàng, mã giảm giá
const router = require('express').Router();
const db = require('../../db');
const { wrap, httpError, pick, paging } = require('../../utils');

const dateKey = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

router.get('/stats/revenue', wrap(async (req, res) => {
  const requestedDays = req.query.days === undefined ? 30 : Number(req.query.days);
  if (!Number.isInteger(requestedDays) || requestedDays < 1 || requestedDays > 365) {
    throw httpError(400, 'Số ngày cần nằm trong khoảng 1 đến 365.');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - requestedDays + 1);
  const end = new Date(today);
  end.setDate(end.getDate() + 1);

  const [rows] = await db.query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day,
       COALESCE(SUM(total_amount), 0) AS revenue, COUNT(*) AS order_count
     FROM orders
     WHERE status = ? AND created_at >= ? AND created_at < ?
     GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
     ORDER BY day`,
    ['COMPLETED', dateKey(start), dateKey(end)]);
  const byDay = new Map(rows.map((row) => [String(row.day).slice(0, 10), row]));
  const data = [];
  for (let offset = 0; offset < requestedDays; offset++) {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);
    const key = dateKey(day);
    const row = byDay.get(key);
    data.push({
      date: key,
      revenue: row ? row.revenue : 0,
      order_count: row ? row.order_count : 0,
    });
  }
  res.json({ days: requestedDays, data });
}));

router.get('/stats', wrap(async (req, res) => {
  const [byStatus] = await db.query('SELECT status, COUNT(*) AS count FROM orders GROUP BY status');
  const [[rev]] = await db.query("SELECT COALESCE(SUM(total_amount), 0) AS revenue FROM orders WHERE status = 'COMPLETED'");
  const [[prod]] = await db.query("SELECT COUNT(*) AS n FROM products WHERE status = 'ACTIVE'");
  const [[cus]] = await db.query("SELECT COUNT(*) AS n FROM users WHERE user_type = 'CUSTOMER'");
  const [lowStock] = await db.query(
    'SELECT * FROM v_product_stock WHERE stock_quantity <= 5 ORDER BY stock_quantity, product_id LIMIT 10');
  const [topProducts] = await db.query(
    `SELECT oi.product_name, COALESCE(SUM(oi.quantity), 0) AS total_quantity
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE o.status NOT IN (?, ?)
     GROUP BY oi.product_name
     ORDER BY total_quantity DESC, oi.product_name
     LIMIT 5`,
    ['CANCELLED', 'RETURNED']);
  res.json({
    orders_by_status: byStatus,
    revenue: rev.revenue,
    active_products: prod.n,
    customers: cus.n,
    low_stock: lowStock,
    top_products: topProducts,
  });
}));

// ---- Người dùng ----
router.get('/users', wrap(async (req, res) => {
  const { page, limit, offset } = paging(req.query);
  const where = [];
  const params = [];
  if (req.query.type) { where.push('u.user_type = ?'); params.push(req.query.type); }
  if (req.query.status) {
    if (!['ACTIVE', 'INACTIVE', 'BLOCKED'].includes(req.query.status)) throw httpError(400, `Trạng thái tài khoản không hợp lệ: ${req.query.status}`);
    where.push('u.status = ?');
    params.push(req.query.status);
  }
  if (req.query.q) {
    where.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
    params.push(`%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`);
  }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM users u ${w}`, params);
  const [rows] = await db.query(
    `SELECT u.id, u.email, u.full_name, u.phone, u.user_type, u.status, u.created_at,
       (SELECT COUNT(*) FROM orders WHERE user_id = u.id AND status <> 'CANCELLED') AS order_count,
       (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE user_id = u.id AND status = 'COMPLETED') AS total_spent
     FROM users u ${w} ORDER BY u.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  res.json({ data: rows, page, limit, total });
}));

router.get('/users/:id/orders', wrap(async (req, res) => {
  const [customers] = await db.query(
    "SELECT id FROM users WHERE id = ? AND user_type = 'CUSTOMER'",
    [req.params.id]);
  if (!customers.length) throw httpError(404, 'Không tìm thấy khách hàng');

  const { page, limit, offset } = paging(req.query);
  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM orders WHERE user_id = ?', [req.params.id]);
  const [orderRows] = await db.query(
    `SELECT id, order_code, status, payment_status, total_amount, created_at
     FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
    [req.params.id, limit, offset]);
  if (!orderRows.length) return res.json({ data: [], page, limit, total });

  const orderIds = orderRows.map((order) => order.id);
  const placeholders = orderIds.map(() => '?').join(', ');
  const [rows] = await db.query(
    `SELECT o.id, o.order_code, o.status, o.payment_status, o.total_amount, o.created_at,
       oi.id AS item_id, oi.product_name, oi.sku, oi.size_name, oi.color_name, oi.quantity, oi.line_total
     FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.user_id = ? AND o.id IN (${placeholders}) ORDER BY o.id DESC, oi.id`,
    [req.params.id, ...orderIds]);
  const orders = new Map();
  for (const row of rows) {
    if (!orders.has(row.id)) {
      orders.set(row.id, {
        id: row.id,
        order_code: row.order_code,
        status: row.status,
        payment_status: row.payment_status,
        total_amount: row.total_amount,
        created_at: row.created_at,
        items: [],
      });
    }
    if (row.item_id) {
      orders.get(row.id).items.push({
        id: row.item_id,
        product_name: row.product_name,
        sku: row.sku,
        size_name: row.size_name,
        color_name: row.color_name,
        quantity: row.quantity,
        line_total: row.line_total,
      });
    }
  }
  res.json({ data: [...orders.values()], page, limit, total });
}));

router.patch('/users/:id/status', wrap(async (req, res) => {
  if (!['ACTIVE', 'INACTIVE', 'BLOCKED'].includes(req.body.status)) throw httpError(400, 'Trạng thái không hợp lệ');
  await db.query('UPDATE users SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
  res.json({ message: 'Đã cập nhật' });
}));

// ---- Mã giảm giá ----
const COUPON = ['code', 'description', 'discount_type', 'discount_value', 'min_order_amount', 'max_discount',
                'usage_limit', 'per_user_limit', 'starts_at', 'ends_at', 'is_active'];

router.get('/coupons', wrap(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM coupons ORDER BY id DESC');
  res.json(rows);
}));

router.post('/coupons', wrap(async (req, res) => {
  const data = pick(req.body, COUPON);
  for (const k of ['code', 'discount_type', 'discount_value', 'starts_at', 'ends_at'])
    if (!data[k]) throw httpError(400, `Thiếu ${k}`);
  const [r] = await db.query('INSERT INTO coupons SET ?', [data]);
  res.status(201).json({ id: r.insertId });
}));

router.put('/coupons/:id', wrap(async (req, res) => {
  const data = pick(req.body, COUPON);
  if (!Object.keys(data).length) throw httpError(400, 'Không có dữ liệu để cập nhật');
  await db.query('UPDATE coupons SET ? WHERE id = ?', [data, req.params.id]);
  res.json({ message: 'Đã cập nhật' });
}));

module.exports = router;
