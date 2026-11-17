// Giỏ hàng của người đăng nhập (mỗi người có 1 giỏ ACTIVE)
const router = require('express').Router();
const db = require('../db');
const { wrap, httpError } = require('../utils');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

async function getCartId(userId) {
  const [rows] = await db.query("SELECT id FROM carts WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1", [userId]);
  if (rows.length) return rows[0].id;
  const [r] = await db.query('INSERT INTO carts (user_id) VALUES (?)', [userId]);
  return r.insertId;
}

async function cartDetail(cartId) {
  const [items] = await db.query(
    `SELECT ci.id, ci.variant_id, ci.quantity, v.sku, v.price, p.id AS product_id, p.name AS product_name,
            s.name AS size_name, c.name AS color_name,
            COALESCE(v.image_url, (SELECT image_url FROM product_images WHERE product_id = p.id
                                   ORDER BY is_primary DESC, sort_order, id LIMIT 1)) AS image_url,
            COALESCE(i.quantity, 0) AS stock
     FROM cart_items ci
     JOIN product_variants v ON v.id = ci.variant_id
     JOIN products p ON p.id = v.product_id
     JOIN sizes s ON s.id = v.size_id JOIN colors c ON c.id = v.color_id
     LEFT JOIN inventories i ON i.variant_id = v.id
     WHERE ci.cart_id = ? ORDER BY ci.id`, [cartId]);
  const subtotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
  return { id: cartId, items, subtotal };
}

router.get('/', wrap(async (req, res) => res.json(await cartDetail(await getCartId(req.user.id)))));

// Thêm vào giỏ: { variant_id, quantity } (đã có thì cộng dồn)
router.post('/items', wrap(async (req, res) => {
  const variantId = Number(req.body.variant_id);
  const qty = Number(req.body.quantity || 1);
  if (!variantId || !Number.isInteger(qty) || qty < 1) throw httpError(400, 'Dữ liệu không hợp lệ');
  const [v] = await db.query(
    `SELECT v.id FROM product_variants v JOIN products p ON p.id = v.product_id
     WHERE v.id = ? AND v.is_active = 1 AND p.status = 'ACTIVE'`, [variantId]);
  if (!v.length) throw httpError(404, 'Sản phẩm không còn bán');
  const cartId = await getCartId(req.user.id);
  await db.query(
    `INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`, [cartId, variantId, qty]);
  res.status(201).json(await cartDetail(cartId));
}));

// Đổi số lượng: { quantity }
router.put('/items/:id', wrap(async (req, res) => {
  const qty = Number(req.body.quantity);
  if (!Number.isInteger(qty) || qty < 1) throw httpError(400, 'Số lượng không hợp lệ');
  const cartId = await getCartId(req.user.id);
  await db.query('UPDATE cart_items SET quantity = ? WHERE id = ? AND cart_id = ?', [qty, req.params.id, cartId]);
  res.json(await cartDetail(cartId));
}));

router.delete('/items/:id', wrap(async (req, res) => {
  const cartId = await getCartId(req.user.id);
  await db.query('DELETE FROM cart_items WHERE id = ? AND cart_id = ?', [req.params.id, cartId]);
  res.json(await cartDetail(cartId));
}));

module.exports = router;
