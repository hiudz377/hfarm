const router = require('express').Router();
const db = require('../../db');
const { wrap, httpError, pick, uniqueSlug, tx } = require('../../utils');
const { listProducts, getProduct } = require('../../services/products');
const { changeStock } = require('../../services/stock');

async function insertImages(conn, productId, images) {
  for (let i = 0; i < images.length; i++) {
    const url = typeof images[i] === 'string' ? images[i] : images[i].image_url;
    if (url) await conn.query(
      'INSERT INTO product_images (product_id, image_url, is_primary, sort_order) VALUES (?,?,?,?)',
      [productId, url, i === 0, i]);
  }
}

// Thêm 1 biến thể + dòng tồn kho (+ lịch sử nhập kho nếu có số lượng ban đầu)
async function insertVariant(conn, productId, v, basePrice, userId) {
  if (!v.size_id || !v.color_id || !v.sku) throw httpError(400, 'Biến thể cần size, màu và SKU');
  const [r] = await conn.query(
    `INSERT INTO product_variants (product_id, size_id, color_id, sku, price, compare_at_price, image_url)
     VALUES (?,?,?,?,?,?,?)`,
    [productId, v.size_id, v.color_id, v.sku, v.price ?? basePrice, v.compare_at_price || null, v.image_url || null]);
  await conn.query('INSERT INTO inventories (variant_id, quantity) VALUES (?, 0)', [r.insertId]);
  if (Number(v.quantity) > 0)
    await changeStock(conn, { variantId: r.insertId, type: 'IMPORT', quantity: v.quantity, userId, note: 'Nhập kho ban đầu' });
  return r.insertId;
}

router.get('/', wrap(async (req, res) => res.json(await listProducts(req.query, false))));
router.get('/:id', wrap(async (req, res) => res.json(await getProduct(req.params.id, false))));

// { category_id, brand_id, name, description, base_price, status, images: [url], variants: [{size_id,color_id,sku,price,quantity}] }
router.post('/', wrap(async (req, res) => {
  const { name, category_id, base_price, brand_id, description, status, images = [], variants = [] } = req.body;
  if (!name || !category_id || base_price === undefined) throw httpError(400, 'Cần tên, danh mục và giá gốc');
  const id = await tx(async (conn) => {
    const [r] = await conn.query(
      `INSERT INTO products (category_id, brand_id, name, slug, description, base_price, status, created_by)
       VALUES (?,?,?,?,?,?,?,?)`,
      [category_id, brand_id || null, name, uniqueSlug(name), description || null, base_price, status || 'DRAFT', req.user.id]);
    await insertImages(conn, r.insertId, images);
    for (const v of variants) await insertVariant(conn, r.insertId, v, base_price, req.user.id);
    return r.insertId;
  });
  res.status(201).json({ id });
}));

// Sửa thông tin chung. Nếu gửi "images" thì thay toàn bộ ảnh
router.put('/:id', wrap(async (req, res) => {
  const data = pick(req.body, ['category_id', 'brand_id', 'name', 'description', 'base_price', 'status']);
  await tx(async (conn) => {
    if (Object.keys(data).length) await conn.query('UPDATE products SET ? WHERE id = ?', [data, req.params.id]);
    if (Array.isArray(req.body.images)) {
      await conn.query('DELETE FROM product_images WHERE product_id = ?', [req.params.id]);
      await insertImages(conn, req.params.id, req.body.images);
    }
  });
  res.json({ message: 'Đã cập nhật' });
}));

// Không xóa cứng (đơn cũ còn tham chiếu): chỉ chuyển sang INACTIVE
router.delete('/:id', wrap(async (req, res) => {
  await db.query("UPDATE products SET status = 'INACTIVE' WHERE id = ?", [req.params.id]);
  res.json({ message: 'Đã ngừng bán sản phẩm' });
}));

// ---- Biến thể ----
router.post('/:id/variants', wrap(async (req, res) => {
  const [p] = await db.query('SELECT base_price FROM products WHERE id = ?', [req.params.id]);
  if (!p.length) throw httpError(404, 'Không tìm thấy sản phẩm');
  const id = await tx((conn) => insertVariant(conn, req.params.id, req.body, p[0].base_price, req.user.id));
  res.status(201).json({ id });
}));

router.post('/:id/variants/bulk', wrap(async (req, res) => {
  const { variants } = req.body;
  if (!Array.isArray(variants) || !variants.length || variants.length > 100) {
    throw httpError(400, 'Cần gửi từ 1 đến 100 biến thể.');
  }
  const [products] = await db.query('SELECT base_price FROM products WHERE id = ?', [req.params.id]);
  if (!products.length) throw httpError(404, 'Không tìm thấy sản phẩm');
  for (const variant of variants) {
    if (!Number.isInteger(Number(variant.size_id)) || Number(variant.size_id) < 1
      || !Number.isInteger(Number(variant.color_id)) || Number(variant.color_id) < 1
      || !String(variant.sku || '').trim()
      || !Number.isInteger(Number(variant.quantity)) || Number(variant.quantity) < 0) {
      throw httpError(400, 'Thông tin biến thể hoặc số lượng ban đầu không hợp lệ.');
    }
  }
  const ids = await tx(async (conn) => {
    const inserted = [];
    for (const variant of variants) {
      inserted.push(await insertVariant(conn, req.params.id, variant, products[0].base_price, req.user.id));
    }
    return inserted;
  });
  res.status(201).json({ ids });
}));

router.put('/variants/:variantId', wrap(async (req, res) => {
  const data = pick(req.body, ['sku', 'price', 'compare_at_price', 'image_url', 'is_active']);
  if (!Object.keys(data).length) throw httpError(400, 'Không có dữ liệu để cập nhật');
  await db.query('UPDATE product_variants SET ? WHERE id = ?', [data, req.params.variantId]);
  res.json({ message: 'Đã cập nhật biến thể' });
}));

// Nhập / xuất / điều chỉnh kho: { type: IMPORT|EXPORT|ADJUSTMENT, quantity, note }
router.post('/variants/:variantId/stock', wrap(async (req, res) => {
  const { type, quantity, note } = req.body;
  if (!['IMPORT', 'EXPORT', 'ADJUSTMENT'].includes(type)) throw httpError(400, 'Loại thao tác không hợp lệ');
  const after = await tx((conn) =>
    changeStock(conn, { variantId: req.params.variantId, type, quantity, userId: req.user.id, note }));
  res.json({ quantity: after });
}));

router.get('/variants/:variantId/movements', wrap(async (req, res) => {
  const [rows] = await db.query(
    `SELECT m.*, u.full_name AS created_by_name FROM inventory_movements m
     LEFT JOIN users u ON u.id = m.created_by WHERE m.variant_id = ? ORDER BY m.id DESC LIMIT 50`, [req.params.variantId]);
  res.json(rows);
}));

module.exports = router;
