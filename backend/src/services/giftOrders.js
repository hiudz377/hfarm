// Đơn quà tặng: đặt hàng như thường (createOrder, KHÔNG sửa) rồi ghi thiệp + tùy chọn vào bảng order_gifts (migration 005).
// Phần tính toán thuần (thiệp, lời chúc, gợi ý quà) nằm ở services/gifts.js.
const db = require('../db');
const { httpError } = require('../utils');
const { createOrder, changeOrderStatus } = require('./orders');
const { bankConfig } = require('./paymentConfig');
const { OCCASIONS, cardOf, parseGiftOrder } = require('./gifts');

// Gói quà là MỘT SẢN PHẨM THƯỜNG của cửa hàng (có giá, có tồn kho); nhân viên tạo ở CMS rồi đặt SKU của nó vào GIFT_WRAP_SKU.
// Chưa đặt, hoặc sản phẩm ngừng bán / hết hàng thì app không hiện lựa chọn "gói quà".
const wrapSku = () => String(process.env.GIFT_WRAP_SKU || '').trim();

async function wrapInfo() {
  const sku = wrapSku();
  if (!sku) return null;
  const [rows] = await db.query(
    `SELECT v.id AS variant_id, v.price, p.name, i.quantity AS stock
     FROM product_variants v
     JOIN products p ON p.id = v.product_id
     JOIN inventories i ON i.variant_id = v.id
     WHERE v.sku = ? AND v.is_active = 1 AND p.status = 'ACTIVE' AND i.quantity > 0 LIMIT 1`, [sku]);
  return rows[0] ? { variant_id: rows[0].variant_id, name: rows[0].name, price: Number(rows[0].price), stock: Number(rows[0].stock) } : null;
}

// Thông tin quà của một đơn (null nếu không phải đơn quà). card: mẫu thiệp đầy đủ để app / CMS tự vẽ.
async function getGift(orderId) {
  const [rows] = await db.query('SELECT * FROM order_gifts WHERE order_id = ?', [orderId]);
  const g = rows[0];
  if (!g) return null;
  return {
    occasion: g.occasion,
    occasion_label: OCCASIONS[g.occasion]?.label ?? null,
    card: g.card_template ? cardOf(g.card_template) : null,
    card_message: g.card_message,
    sender_name: g.sender_name,
    hide_prices: !!g.hide_prices,
    wrap: !!g.wrap,
  };
}

// Đặt đơn quà. body: { address_id, coupon_code?, customer_note?, payment_method (phải là BANK_TRANSFER), gift: {...} }
// Luôn lấy hàng từ giỏ (không nhận body.items) nên vẫn đi qua khóa giỏ + trừ kho của createOrder.
async function checkoutGift(userId, body = {}) {
  // Kiểm tra mọi thứ có thể kiểm tra TRƯỚC khi tạo đơn: lỗi nhập liệu không được làm mất giỏ hàng
  const gift = parseGiftOrder(body.gift);
  // COD bị chặn: người nhận quà sẽ phải trả tiền món quà của chính mình
  if (body.payment_method !== 'BANK_TRANSFER') {
    throw httpError(400, 'Đơn quà chỉ thanh toán bằng chuyển khoản, để người nhận không phải trả tiền món quà của mình.');
  }
  if (!bankConfig().configured) throw httpError(400, 'Cửa hàng chưa bật thanh toán chuyển khoản nên chưa nhận được đơn quà.');

  const order = await createOrder(userId, {
    address_id: body.address_id,
    coupon_code: body.coupon_code,
    customer_note: body.customer_note,
    payment_method: 'BANK_TRANSFER',
  });

  try {
    const sku = wrapSku();
    let wrap = 0;
    if (sku) {
      const [lines] = await db.query('SELECT 1 FROM order_items WHERE order_id = ? AND sku = ? LIMIT 1', [order.id, sku]);
      wrap = lines.length ? 1 : 0;
    }
    await db.query(
      `INSERT INTO order_gifts (order_id, occasion, card_template, card_message, sender_name, hide_prices, wrap)
       VALUES (?,?,?,?,?,?,?)`,
      [order.id, gift.occasion, gift.card_template, gift.card_message, gift.sender_name, gift.hide_prices ? 1 : 0, wrap]);
  } catch (e) {
    // Đơn đã tạo nhưng không lưu được thiệp / cờ ẩn giá: hủy ngay (hoàn kho) để không có đơn quà mà giá vẫn in trong hộp
    console.error('Không lưu được order_gifts, hủy đơn', order.id, e);
    try {
      await changeOrderStatus(order.id, 'CANCELLED', userId, 'Hệ thống tự hủy: không lưu được thông tin quà tặng');
    } catch (e2) {
      console.error('Không hủy được đơn quà lỗi', order.id, e2);
    }
    throw httpError(500, 'Không lưu được thiệp nên đơn đã được hủy, xin lỗi bạn. Hãy chọn lại quà rồi đặt lại.');
  }
  return { ...order, gift: await getGift(order.id) };
}

module.exports = { wrapInfo, getGift, checkoutGift };
