const db = require('../db');
const { httpError, tx } = require('../utils');
const { changeStock } = require('./stock');

const SHIPPING_FEE = 30000;
const FREE_SHIP_OVER = 500000;

// Các bước chuyển trạng thái được phép
const TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['COMPLETED', 'RETURNED'],
  COMPLETED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

const newOrderCode = () => {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `HT${d}${Math.floor(10000 + Math.random() * 90000)}`;
};

async function loadCart(userId) {
  const [carts] = await db.query("SELECT id FROM carts WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1", [userId]);
  if (!carts.length) return { cartId: null, items: [] };
  const [items] = await db.query('SELECT variant_id, quantity FROM cart_items WHERE cart_id = ?', [carts[0].id]);
  return { cartId: carts[0].id, items };
}

// ---- Tính tiền: DÙNG CHUNG cho createOrder và quoteOrder để hai bên luôn khớp ----

// 300000 -> "300.000đ" (dùng trong thông báo lỗi)
const vnd = (n) => `${String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;

// Lấy dòng hàng từ body.items, bỏ trống thì lấy từ giỏ ACTIVE. Trả { cartId, items }.
async function resolveItems(userId, body) {
  let cartId = null;
  let items = body.items;
  if (!Array.isArray(items) || !items.length) ({ cartId, items } = await loadCart(userId));
  if (!items.length) throw httpError(400, 'Giỏ hàng trống');
  return { cartId, items };
}

// Gộp dòng trùng, sắp xếp theo id để tránh deadlock khi khóa kho
function mergeLines(items) {
  const merged = new Map();
  for (const it of items) {
    const vid = Number(it.variant_id);
    const qty = Number(it.quantity);
    if (!vid || !Number.isInteger(qty) || qty < 1) throw httpError(400, 'Sản phẩm hoặc số lượng không hợp lệ');
    merged.set(vid, (merged.get(vid) || 0) + qty);
  }
  return [...merged.entries()].sort((a, b) => a[0] - b[0]);
}

// Đọc giá từng biến thể (phải còn bán). exec: pool hoặc connection trong transaction.
async function priceLines(exec, lines) {
  let subtotal = 0;
  const detailed = [];
  for (const [variantId, qty] of lines) {
    const [rows] = await exec.query(
      `SELECT v.id, v.sku, v.price, v.is_active, p.name, p.status, s.name AS size_name, c.name AS color_name
       FROM product_variants v JOIN products p ON p.id = v.product_id
       JOIN sizes s ON s.id = v.size_id JOIN colors c ON c.id = v.color_id
       WHERE v.id = ?`, [variantId]);
    const v = rows[0];
    if (!v || !v.is_active || v.status !== 'ACTIVE') throw httpError(400, `Sản phẩm (mã ${variantId}) không còn bán`);
    subtotal += v.price * qty;
    detailed.push({ v, qty });
  }
  return { subtotal, detailed };
}

// Kiểm tra mã giảm giá và tính số tiền giảm. forUpdate = true khi đặt hàng thật (khóa dòng coupon).
async function applyCoupon(exec, { code, subtotal, userId, forUpdate = false }) {
  if (!code) return { coupon: null, discount: 0 };
  const [cs] = await exec.query(
    `SELECT * FROM coupons WHERE code = ? AND is_active = 1 AND NOW() BETWEEN starts_at AND ends_at${forUpdate ? ' FOR UPDATE' : ''}`,
    [code]);
  const coupon = cs[0];
  if (!coupon) throw httpError(400, 'Mã giảm giá không hợp lệ hoặc đã hết hạn');
  if (subtotal < coupon.min_order_amount) throw httpError(400, `Đơn tối thiểu ${vnd(coupon.min_order_amount)} để dùng mã này`);
  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) throw httpError(400, 'Mã đã hết lượt dùng');
  if (coupon.per_user_limit !== null) {
    const [[{ n }]] = await exec.query(
      'SELECT COUNT(*) AS n FROM coupon_usages WHERE coupon_id = ? AND user_id = ?', [coupon.id, userId]);
    if (n >= coupon.per_user_limit) throw httpError(400, 'Bạn đã dùng hết lượt của mã này');
  }
  let discount = coupon.discount_type === 'PERCENTAGE' ? (subtotal * coupon.discount_value) / 100 : coupon.discount_value;
  if (coupon.max_discount !== null) discount = Math.min(discount, coupon.max_discount);
  discount = Math.round(Math.min(discount, subtotal));
  return { coupon, discount };
}

// Phí ship + tổng tiền từ tạm tính và số tiền giảm
function computeTotals(subtotal, discount) {
  const shippingFee = subtotal >= FREE_SHIP_OVER ? 0 : SHIPPING_FEE;
  return { subtotal, discount_amount: discount, shipping_fee: shippingFee, total_amount: subtotal - discount + shippingFee };
}

// Xem trước tiền (không ghi gì vào DB, không kiểm tra tồn kho).
// body: { items?: [{variant_id, quantity}] (bỏ trống = lấy từ giỏ), coupon_code }
async function quoteOrder(userId, body) {
  const { items } = await resolveItems(userId, body);
  const lines = mergeLines(items);
  const { subtotal } = await priceLines(db, lines);
  const { discount } = await applyCoupon(db, { code: body.coupon_code, subtotal, userId });
  return computeTotals(subtotal, discount);
}

// Đặt hàng. body: { address_id | (recipient_name, recipient_phone, province, district, ward, address_detail),
//                   items?: [{variant_id, quantity}] (bỏ trống = lấy từ giỏ), payment_method, coupon_code, customer_note }
async function createOrder(userId, body) {
  const { cartId, items } = await resolveItems(userId, body);
  const lines = mergeLines(items);

  // Địa chỉ giao hàng
  let addr;
  if (body.address_id) {
    const [a] = await db.query('SELECT * FROM addresses WHERE id = ? AND user_id = ?', [body.address_id, userId]);
    if (!a.length) throw httpError(400, 'Địa chỉ không tồn tại');
    addr = { name: a[0].recipient_name, phone: a[0].phone, province: a[0].province,
             district: a[0].district, ward: a[0].ward, detail: a[0].address_detail };
  } else {
    const { recipient_name, recipient_phone, province, district, ward, address_detail } = body;
    if (![recipient_name, recipient_phone, province, district, ward, address_detail].every(Boolean))
      throw httpError(400, 'Thiếu thông tin giao hàng');
    addr = { name: recipient_name, phone: recipient_phone, province, district, ward, detail: address_detail };
  }
  const method = ['COD', 'BANK_TRANSFER', 'ONLINE'].includes(body.payment_method) ? body.payment_method : 'COD';

  return tx(async (conn) => {
    const { subtotal, detailed } = await priceLines(conn, lines);
    const { coupon, discount } = await applyCoupon(conn, { code: body.coupon_code, subtotal, userId, forUpdate: true });
    const { shipping_fee: shippingFee, total_amount: total } = computeTotals(subtotal, discount);

    const orderCode = newOrderCode();
    const [o] = await conn.query(
      `INSERT INTO orders (order_code, user_id, recipient_name, recipient_phone, province, district, ward,
         shipping_address, subtotal, discount_amount, shipping_fee, total_amount, coupon_id, customer_note)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [orderCode, userId, addr.name, addr.phone, addr.province, addr.district, addr.ward, addr.detail,
       subtotal, discount, shippingFee, total, coupon ? coupon.id : null, body.customer_note || null]);
    const orderId = o.insertId;

    for (const { v, qty } of detailed) {
      await conn.query(
        `INSERT INTO order_items (order_id, variant_id, product_name, sku, size_name, color_name, unit_price, quantity, line_total)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [orderId, v.id, v.name, v.sku, v.size_name, v.color_name, v.price, qty, v.price * qty]);
      await changeStock(conn, { variantId: v.id, type: 'ORDER_DEDUCT', quantity: qty, userId,
        refType: 'ORDER', refId: orderId, label: `${v.name} (${v.size_name}/${v.color_name})` });
    }

    await conn.query('INSERT INTO payments (order_id, payment_method, amount) VALUES (?,?,?)', [orderId, method, total]);
    await conn.query(
      'INSERT INTO order_status_history (order_id, changed_by, old_status, new_status, note) VALUES (?,?,?,?,?)',
      [orderId, userId, null, 'PENDING', 'Khách đặt hàng']);
    if (coupon) {
      await conn.query('INSERT INTO coupon_usages (coupon_id, user_id, order_id, discount_amount) VALUES (?,?,?,?)',
        [coupon.id, userId, orderId, discount]);
      await conn.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [coupon.id]);
    }
    if (cartId) await conn.query("UPDATE carts SET status = 'CONVERTED' WHERE id = ?", [cartId]);

    return { id: orderId, order_code: orderCode, subtotal, discount_amount: discount, shipping_fee: shippingFee, total_amount: total };
  });
}

// Đổi trạng thái đơn. Hủy/hoàn trả thì tự cộng lại tồn kho.
// opts: { carrier, tracking_code, ownerOnlyUserId } (ownerOnlyUserId: khách tự hủy đơn của mình)
async function changeOrderStatus(orderId, newStatus, userId, note, opts = {}) {
  return tx(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    const order = rows[0];
    if (!order) throw httpError(404, 'Không tìm thấy đơn hàng');
    if (opts.ownerOnlyUserId && order.user_id !== opts.ownerOnlyUserId) throw httpError(403, 'Không đủ quyền');
    if (!(TRANSITIONS[order.status] || []).includes(newStatus))
      throw httpError(400, `Không thể chuyển từ ${order.status} sang ${newStatus}`);

    if (newStatus === 'CANCELLED' || newStatus === 'RETURNED') {
      const [items] = await conn.query(
        'SELECT variant_id, quantity FROM order_items WHERE order_id = ? AND variant_id IS NOT NULL ORDER BY variant_id',
        [orderId]);
      for (const it of items) {
        await changeStock(conn, { variantId: it.variant_id, type: 'ORDER_RESTOCK', quantity: it.quantity,
          userId, refType: 'ORDER', refId: orderId, note: `Hoàn kho (${newStatus})` });
      }
      if (order.payment_status === 'PAID') {
        await conn.query("UPDATE orders SET payment_status = 'REFUNDED' WHERE id = ?", [orderId]);
        await conn.query("UPDATE payments SET status = 'REFUNDED' WHERE order_id = ?", [orderId]);
      }
    }
    if (newStatus === 'CONFIRMED') await conn.query('UPDATE orders SET confirmed_by = ? WHERE id = ?', [userId, orderId]);
    if (newStatus === 'SHIPPING') {
      await conn.query(
        `INSERT INTO shipments (order_id, carrier, tracking_code, status, shipping_fee, shipped_at)
         VALUES (?,?,?, 'IN_TRANSIT', ?, NOW())
         ON DUPLICATE KEY UPDATE carrier = VALUES(carrier), tracking_code = VALUES(tracking_code),
           status = 'IN_TRANSIT', shipped_at = NOW()`,
        [orderId, opts.carrier || null, opts.tracking_code || null, order.shipping_fee]);
    }
    if (newStatus === 'COMPLETED') {
      await conn.query("UPDATE shipments SET status = 'DELIVERED', delivered_at = NOW() WHERE order_id = ?", [orderId]);
      if (order.payment_status === 'UNPAID') { // COD: thu tiền khi giao xong
        await conn.query("UPDATE orders SET payment_status = 'PAID' WHERE id = ?", [orderId]);
        await conn.query("UPDATE payments SET status = 'PAID', paid_at = NOW() WHERE order_id = ?", [orderId]);
      }
    }

    await conn.query('UPDATE orders SET status = ? WHERE id = ?', [newStatus, orderId]);
    await conn.query(
      'INSERT INTO order_status_history (order_id, changed_by, old_status, new_status, note) VALUES (?,?,?,?,?)',
      [orderId, userId, order.status, newStatus, note || null]);
    return { status: newStatus };
  });
}

async function getOrderDetail(orderId, ownerId = null) {
  const [rows] = await db.query(
    `SELECT o.*, u.full_name AS customer_name, u.email AS customer_email, u.phone AS customer_phone
     FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?`, [orderId]);
  const order = rows[0];
  if (!order || (ownerId && order.user_id !== ownerId)) throw httpError(404, 'Không tìm thấy đơn hàng');
  const [items] = await db.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
  const [history] = await db.query(
    `SELECT h.*, u.full_name AS changed_by_name FROM order_status_history h
     LEFT JOIN users u ON u.id = h.changed_by WHERE h.order_id = ? ORDER BY h.id`, [orderId]);
  const [payments] = await db.query('SELECT * FROM payments WHERE order_id = ?', [orderId]);
  const [shipments] = await db.query('SELECT * FROM shipments WHERE order_id = ?', [orderId]);
  return { ...order, items, history, payment: payments[0] || null, shipment: shipments[0] || null };
}

module.exports = { createOrder, quoteOrder, changeOrderStatus, getOrderDetail, TRANSITIONS };
