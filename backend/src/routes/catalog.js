// API công khai (không cần đăng nhập): dùng cho trang khách hàng / mobile
const router = require('express').Router();
const db = require('../db');
const { wrap } = require('../utils');
const { listProducts, getProduct, suggestProducts, relatedProducts } = require('../services/products');
const { listReviews } = require('../services/reviews');
const { groupSizes } = require('../services/sizes');

// ?in_use=1: chỉ trả những mục đang có sản phẩm ĐANG BÁN dùng (size/màu có biến thể đang bán, thương hiệu có sản phẩm đang bán).
// Mobile dùng cho bảng lọc để không hiện size/màu/thương hiệu mà chọn xong chỉ ra kết quả trống.
const inUse = (req) => req.query.in_use === '1' || req.query.in_use === 'true';

router.get('/categories', wrap(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM categories WHERE is_active = 1 ORDER BY id');
  res.json(rows);
}));
router.get('/brands', wrap(async (req, res) => {
  const [rows] = inUse(req)
    ? await db.query(
      `SELECT b.* FROM brands b
       WHERE b.is_active = 1 AND EXISTS (SELECT 1 FROM products p WHERE p.brand_id = b.id AND p.status = 'ACTIVE')
       ORDER BY b.name`)
    : await db.query('SELECT * FROM brands WHERE is_active = 1 ORDER BY name');
  res.json(rows);
}));
// Mỗi size có thêm size_group: LETTER (XS..XXL, 2XL...) | NUMBER (28, 30, 38.5...) | OTHER. Thứ tự: chữ, số, khác.
router.get('/sizes', wrap(async (req, res) => {
  const [rows] = inUse(req)
    ? await db.query(
      `SELECT s.* FROM sizes s
       WHERE EXISTS (SELECT 1 FROM product_variants v JOIN products p ON p.id = v.product_id AND p.status = 'ACTIVE'
                     WHERE v.size_id = s.id AND v.is_active = 1)`)
    : await db.query('SELECT * FROM sizes');
  res.json(groupSizes(rows));
}));
router.get('/colors', wrap(async (req, res) => {
  const [rows] = inUse(req)
    ? await db.query(
      `SELECT c.* FROM colors c
       WHERE EXISTS (SELECT 1 FROM product_variants v JOIN products p ON p.id = v.product_id AND p.status = 'ACTIVE'
                     WHERE v.color_id = c.id AND v.is_active = 1)
       ORDER BY c.id`)
    : await db.query('SELECT * FROM colors ORDER BY id');
  res.json(rows);
}));

// ?q=áo&category_id=1&brand_id=1,2&size_id=2,3&color_id=1&min_price=100000&max_price=500000&in_stock=1
// &sort=newest|price_asc|price_desc|bestseller&page=1&limit=10
router.get('/products', wrap(async (req, res) => res.json(await listProducts(req.query, true))));
// Gợi ý khi gõ ô tìm kiếm: ?q=ao&limit=8 -> [{ id, name, price, thumbnail }] (phải khai báo trước /products/:id)
router.get('/products/suggest', wrap(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 8, 1), 20);
  res.json(await suggestProducts(req.query.q, limit));
}));
router.get('/products/:id', wrap(async (req, res) => res.json(await getProduct(req.params.id, true))));
// Sản phẩm liên quan: ?limit=8 -> mảng sản phẩm cùng dạng với danh sách
router.get('/products/:id/related', wrap(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 8, 1), 24);
  res.json(await relatedProducts(req.params.id, limit));
}));
// Đánh giá đã duyệt của sản phẩm: ?page=1&limit=5 -> { summary: { count, average, distribution }, data, page, limit, total }
router.get('/products/:id/reviews', wrap(async (req, res) => res.json(await listReviews(req.params.id, req.query))));

module.exports = router;
