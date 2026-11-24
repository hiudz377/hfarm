const crypto = require('crypto');
const db = require('../db');
const { httpError, tx } = require('../utils');
const { changeStock } = require('./stock');
const { feeFor } = require('./shipping');
const { bankConfig, holdMinutes } = require('./paymentConfig');

// Phí ship tính theo vùng của tỉnh nhận hàng (bảng shipping_zones, chỉnh trong CMS): xem services/shipping.js
// Đơn vị vận chuyển mặc định khi nhân viên không nhập (đặt DEFAULT_CARRIER trong .env để đổi)
const DEFAULT_CARRIER = process.env.DEFAULT_CARRIER || 'HFarm Express';

const STATUS_LABEL = {
  PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', PROCESSING: 'Đang xử lý', SHIPPING: 'Đang giao',
  COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy', RETURNED: 'Hoàn trả',
};

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

// Mã vận đơn tự sinh: HF + ngày (yyMMdd) + 6 ký tự ngẫu nhiên, bỏ các ký tự dễ nhầm (I, O, 0, 1). Ví dụ HF261118K7M2QP.
// conn: connection trong transaction. Kiểm tra trùng trước; cột tracking_code còn có UNIQUE KEY chặn lần cuối.
const TRACKING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
async function generateTrackingCode(conn) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const day = `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  for (let attempt = 0; attempt < 10; attempt++) {
    let suffix = '';
    for (let i = 0; i < 6; i++) suffix += TRACKING_ALPHABET[crypto.randomInt(TRACKING_ALPHABET.length)];
    const code = `HF${day}${suffix}`;
    const [rows] = await conn.query('SELECT 1 FROM shipments WHERE tracking_code = ? LIMIT 1', [code]);
    if (!rows.length) return code;
  }
  throw httpError(500, 'Không tạo được mã vận đơn, hãy thử lại');
}

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

// Tổng tiền từ tạm tính, số tiền giảm và phí ship (đã tính theo vùng)
function computeTotals(subtotal, discount, shippingFee) {
  return { subtotal, discount_amount: discount, shipping_fee: shippingFee, total_amount: subtotal - discount + shippingFee };
}

// Xem trước tiền (không ghi gì vào DB, không kiểm tra tồn kho).
// body: { items?: [{variant_id, quantity}] (bỏ trống = lấy từ giỏ), coupon_code, address_id? | province? }
// Có địa chỉ thì phí ship theo vùng của tỉnh đó; không có thì dùng vùng mặc định. Trả thêm shipping_zone (tên vùng, số ngày giao).
async function quoteOrder(userId, body) {
  const { items } = await resolveItems(userId, body);
  const lines = mergeLines(items);
  const { subtotal } = await priceLines(db, lines);
  const { discount } = await applyCoupon(db, { code: body.coupon_code, subtotal, userId });
  let province = body.province || '';
  if (body.address_id) {
    const [a] = await db.query('SELECT province FROM addresses WHERE id = ? AND user_id = ?', [body.address_id, userId]);
    if (!a.length) throw httpError(400, 'Địa chỉ không tồn tại');
    province = a[0].province;
  }
  const ship = await feeFor(db, province, subtotal);
  return { ...computeTotals(subtotal, discount, ship.fee), shipping_zone: ship };
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
  // Chưa cấu hình tài khoản ngân hàng thì không có QR/thông tin để khách chuyển: từ chối thay vì tạo đơn không trả tiền được
  if (method === 'BANK_TRANSFER' && !bankConfig().configured) throw httpError(400, 'Cửa hàng chưa bật thanh toán chuyển khoản');

  return tx(async (conn) => {
    // Đặt từ giỏ: khóa dòng giỏ rồi đọc lại hàng trong giỏ ngay trong transaction. Hai yêu cầu cùng lúc cho một giỏ
    // (bấm đúp, mạng chập chờn gửi lại...) sẽ xếp hàng: yêu cầu thứ hai thấy giỏ đã CONVERTED nên bị từ chối,
    // không tạo đơn thứ hai và không trừ kho lần nữa.
    let orderLines = lines;
    if (cartId) {
      const [cart] = await conn.query('SELECT status FROM carts WHERE id = ? FOR UPDATE', [cartId]);
      if (!cart.length || cart[0].status !== 'ACTIVE') throw httpError(400, 'Giỏ hàng trống');
      const [fresh] = await conn.query('SELECT variant_id, quantity FROM cart_items WHERE cart_id = ?', [cartId]);
      if (!fresh.length) throw httpError(400, 'Giỏ hàng trống');
      orderLines = mergeLines(fresh);
    }

    const { subtotal, detailed } = await priceLines(conn, orderLines);
    const { coupon, discount } = await applyCoupon(conn, { code: body.coupon_code, subtotal, userId, forUpdate: true });
    const ship = await feeFor(conn, addr.province, subtotal);
    const { shipping_fee: shippingFee, total_amount: total } = computeTotals(subtotal, discount, ship.fee);

    // Mã đơn có phần ngẫu nhiên nên hiếm khi trùng: trùng thì tự thử mã khác (lỗi trùng khóa chỉ hủy câu INSERT đó,
    // transaction vẫn tiếp tục) thay vì báo lỗi cho khách.
    let orderCode;
    let orderId;
    for (let attempt = 1; ; attempt++) {
      orderCode = newOrderCode();
      try {
        const [o] = await conn.query(
          `INSERT INTO orders (order_code, user_id, recipient_name, recipient_phone, province, district, ward,
             shipping_address, subtotal, discount_amount, shipping_fee, total_amount, coupon_id, customer_note)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [orderCode, userId, addr.name, addr.phone, addr.province, addr.district, addr.ward, addr.detail,
           subtotal, discount, shippingFee, total, coupon ? coupon.id : null, body.customer_note || null]);
        orderId = o.insertId;
        break;
      } catch (e) {
        const dupCode = e.code === 'ER_DUP_ENTRY' && /uq_orders_code|order_code/.test(e.sqlMessage || e.message || '');
        if (!dupCode || attempt >= 5) throw e;
      }
    }

    for (const { v, qty } of detailed) {
      await conn.query(
        `INSERT INTO order_items (order_id, variant_id, product_name, sku, size_name, color_name, unit_price, quantity, line_total)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [orderId, v.id, v.name, v.sku, v.size_name, v.color_name, v.price, qty, v.price * qty]);
      await changeStock(conn, { variantId: v.id, type: 'ORDER_DEDUCT', quantity: qty, userId,
        refType: 'ORDER', refId: orderId, label: `${v.name} (${v.size_name}/${v.color_name})` });
    }

    await conn.query('INSERT INTO payments (order_id, payment_method, amount) VALUES (?,?,?)', [orderId, method, total]);
    // Chuyển khoản: có hạn thanh toán (giờ của MySQL); quá hạn mà chưa trả thì services/payments.js tự hủy đơn + hoàn kho
    if (method === 'BANK_TRANSFER') {
      await conn.query('UPDATE orders SET payment_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?', [holdMinutes(), orderId]);
    }
    await conn.query(
      'INSERT INTO order_status_history (order_id, changed_by, old_status, new_status, note) VALUES (?,?,?,?,?)',
      [orderId, userId, null, 'PENDING', 'Khách đặt hàng']);
    if (coupon) {
      await conn.query('INSERT INTO coupon_usages (coupon_id, user_id, order_id, discount_amount) VALUES (?,?,?,?)',
        [coupon.id, userId, orderId, discount]);
      await conn.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [coupon.id]);
    }
    if (cartId) await conn.query("UPDATE carts SET status = 'CONVERTED' WHERE id = ?", [cartId]);

    return { id: orderId, order_code: orderCode, subtotal, discount_amount: discount, shipping_fee: shippingFee, total_amount: total,
      shipping_zone: ship };
  });
}

// Đổi trạng thái đơn. Hủy/hoàn trả thì tự cộng lại tồn kho.
// opts: { carrier, tracking_code, ownerOnlyUserId } (ownerOnlyUserId: khách tự hủy đơn của mình)
//       requireUnpaid: chỉ làm khi đơn còn UNPAID (tác vụ tự hủy đơn quá hạn: nếu tiền vừa về thì bỏ qua, không hủy đơn đã trả)
async function changeOrderStatus(orderId, newStatus, userId, note, opts = {}) {
  return tx(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    const order = rows[0];
    if (!order) throw httpError(404, 'Không tìm thấy đơn hàng');
    if (opts.ownerOnlyUserId && order.user_id !== opts.ownerOnlyUserId) throw httpError(403, 'Không đủ quyền');
    if (opts.requireUnpaid && order.payment_status !== 'UNPAID') throw httpError(409, 'Đơn đã được thanh toán');
    if (!(TRANSITIONS[order.status] || []).includes(newStatus))
      throw httpError(400, `Không thể chuyển từ "${STATUS_LABEL[order.status] || order.status}" sang "${STATUS_LABEL[newStatus] || newStatus}"`);
    let trackingCode = null;

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
      // Đơn đã hủy/hoàn trả thì mã giảm giá được trả lại lượt dùng (trước đây lượt bị mất vĩnh viễn)
      const [freed] = await conn.query('DELETE FROM coupon_usages WHERE order_id = ?', [orderId]);
      if (freed.affectedRows && order.coupon_id) {
        await conn.query('UPDATE coupons SET used_count = GREATEST(used_count - ?, 0) WHERE id = ?', [freed.affectedRows, order.coupon_id]);
      }
    }
    if (newStatus === 'CONFIRMED') await conn.query('UPDATE orders SET confirmed_by = ? WHERE id = ?', [userId, orderId]);
    if (newStatus === 'SHIPPING') {
      // Nhân viên có thể nhập tay; để trống thì hệ thống tự tạo mã vận đơn (duy nhất) và dùng đơn vị vận chuyển mặc định
      const typed = opts.tracking_code == null ? '' : String(opts.tracking_code).trim();
      if (typed.length > 150) throw httpError(400, 'Mã vận đơn tối đa 150 ký tự');
      if (typed) {
        const [dup] = await conn.query('SELECT 1 FROM shipments WHERE tracking_code = ? AND order_id <> ? LIMIT 1', [typed, orderId]);
        if (dup.length) throw httpError(400, 'Mã vận đơn này đã được dùng cho đơn khác');
      }
      trackingCode = typed || await generateTrackingCode(conn);
      const carrier = (opts.carrier == null ? '' : String(opts.carrier).trim()) || DEFAULT_CARRIER;
      if (carrier.length > 100) throw httpError(400, 'Tên đơn vị vận chuyển tối đa 100 ký tự');
      await conn.query(
        `INSERT INTO shipments (order_id, carrier, tracking_code, status, shipping_fee, shipped_at)
         VALUES (?,?,?, 'IN_TRANSIT', ?, NOW())
         ON DUPLICATE KEY UPDATE carrier = VALUES(carrier), tracking_code = VALUES(tracking_code),
           status = 'IN_TRANSIT', shipped_at = NOW()`,
        [orderId, carrier, trackingCode, order.shipping_fee]);
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
    return { status: newStatus, tracking_code: trackingCode };
  });
}

// ---- Xử lý nhiều đơn một lần (CMS) ----
// Mỗi thao tác = "bước tiếp theo" của đơn. 'ship' từ CONFIRMED đi qua PROCESSING rồi SHIPPING để nhân viên chỉ cần một cú bấm.
const BULK_ACTIONS = {
  confirm: { verb: 'xác nhận', from: ['PENDING'], path: () => ['CONFIRMED'] },
  ship: { verb: 'giao hàng', from: ['CONFIRMED', 'PROCESSING'], path: (s) => (s === 'CONFIRMED' ? ['PROCESSING', 'SHIPPING'] : ['SHIPPING']) },
  complete: { verb: 'hoàn tất', from: ['SHIPPING'], path: () => ['COMPLETED'] },
  cancel: { verb: 'hủy', from: ['PENDING', 'CONFIRMED', 'PROCESSING'], path: () => ['CANCELLED'] },
  return: { verb: 'hoàn trả', from: ['SHIPPING', 'COMPLETED'], path: () => ['RETURNED'] },
};
const MAX_BULK = 100;

// Xử lý lần lượt từng đơn, đơn nào lỗi thì ghi lại rồi đi tiếp (không dừng cả lô).
// Trả { results: [{ id, order_code, ok, status, tracking_code?, error? }], succeeded, failed }.
async function bulkOrderAction(rawIds, action, userId, { note, carrier, tracking_code } = {}) {
  const def = Object.hasOwn(BULK_ACTIONS, action) ? BULK_ACTIONS[action] : null;
  if (!def) throw httpError(400, 'Thao tác không hợp lệ');
  if (!Array.isArray(rawIds) || !rawIds.length) throw httpError(400, 'Chưa chọn đơn hàng nào');
  const ids = [...new Set(rawIds.map((v) => (typeof v === 'number' || /^\d+$/.test(String(v)) ? Number(v) : NaN)))];
  if (ids.some((id) => !Number.isSafeInteger(id) || id < 1)) throw httpError(400, 'Mã đơn hàng không hợp lệ');
  if (ids.length > MAX_BULK) throw httpError(400, `Chỉ xử lý tối đa ${MAX_BULK} đơn mỗi lần`);
  if (String(tracking_code ?? '').trim() && ids.length > 1) throw httpError(400, 'Chỉ nhập mã vận đơn khi xử lý một đơn');

  const [rows] = await db.query('SELECT id, order_code, status FROM orders WHERE id IN (?)', [ids]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const results = [];
  for (const id of ids) {
    const order = byId.get(id);
    if (!order) { results.push({ id, ok: false, error: 'Không tìm thấy đơn hàng' }); continue; }
    if (!def.from.includes(order.status)) {
      results.push({ id, order_code: order.order_code, ok: false, status: order.status,
        error: `Đơn đang ở trạng thái "${STATUS_LABEL[order.status]}" nên không thể ${def.verb}` });
      continue;
    }
    let current = order.status;
    let trackingOut = null;
    try {
      for (const next of def.path(order.status)) {
        const r = await changeOrderStatus(id, next, userId, note, { carrier, tracking_code });
        current = next;
        if (r.tracking_code) trackingOut = r.tracking_code;
      }
      results.push({ id, order_code: order.order_code, ok: true, status: current, tracking_code: trackingOut });
    } catch (e) {
      if (!e.status) console.error(e);
      results.push({ id, order_code: order.order_code, ok: false, status: current,
        error: e.status ? e.message : 'Lỗi hệ thống, hãy thử lại' });
    }
  }
  const succeeded = results.filter((r) => r.ok).length;
  return { results, succeeded, failed: results.length - succeeded };
}

// Số đơn theo từng trạng thái (đủ cả trạng thái có 0 đơn), dùng cho các tab của trang Đơn hàng
async function orderCounts() {
  const [rows] = await db.query('SELECT status, COUNT(*) AS n FROM orders GROUP BY status');
  const counts = Object.fromEntries(Object.keys(TRANSITIONS).map((s) => [s, 0]));
  for (const r of rows) counts[r.status] = Number(r.n);
  return counts;
}

async function getOrderDetail(orderId, ownerId = null) {
  const [rows] = await db.query(
    `SELECT o.*, u.full_name AS customer_name, u.email AS customer_email, u.phone AS customer_phone
     FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?`, [orderId]);
  const order = rows[0];
  if (!order || (ownerId && order.user_id !== ownerId)) throw httpError(404, 'Không tìm thấy đơn hàng');
  // Kèm product_id (mở lại trang sản phẩm) và đánh giá đã gửi cho dòng hàng này (nếu có)
  const [items] = await db.query(
    `SELECT oi.*, pv.product_id, r.id AS review_id, r.rating AS review_rating, r.status AS review_status
     FROM order_items oi
     LEFT JOIN product_variants pv ON pv.id = oi.variant_id
     LEFT JOIN reviews r ON r.order_item_id = oi.id
     WHERE oi.order_id = ? ORDER BY oi.id`, [orderId]);
  const [history] = await db.query(
    `SELECT h.*, u.full_name AS changed_by_name FROM order_status_history h
     LEFT JOIN users u ON u.id = h.changed_by WHERE h.order_id = ? ORDER BY h.id`, [orderId]);
  const [payments] = await db.query('SELECT * FROM payments WHERE order_id = ?', [orderId]);
  const [shipments] = await db.query('SELECT * FROM shipments WHERE order_id = ?', [orderId]);
  return { ...order, items, history, payment: payments[0] || null, shipment: shipments[0] || null };
}

module.exports = {
  createOrder, quoteOrder, changeOrderStatus, getOrderDetail, bulkOrderAction, orderCounts, generateTrackingCode,
  TRANSITIONS, STATUS_LABEL,
};
