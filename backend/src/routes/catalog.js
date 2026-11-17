// API công khai (không cần đăng nhập): dùng cho trang khách hàng / mobile
const router = require('express').Router();
const db = require('../db');
const { wrap } = require('../utils');
const { listProducts, getProduct } = require('../services/products');

router.get('/categories', wrap(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM categories WHERE is_active = 1 ORDER BY id');
  res.json(rows);
}));
router.get('/brands', wrap(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM brands WHERE is_active = 1 ORDER BY name');
  res.json(rows);
}));
router.get('/sizes', wrap(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM sizes ORDER BY sort_order');
  res.json(rows);
}));
router.get('/colors', wrap(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM colors ORDER BY id');
  res.json(rows);
}));

// ?q=áo&category_id=1&brand_id=1,2&size_id=2,3&color_id=1&min_price=100000&max_price=500000&in_stock=1
// &sort=newest|price_asc|price_desc|bestseller&page=1&limit=10
router.get('/products', wrap(async (req, res) => res.json(await listProducts(req.query, true))));
router.get('/products/:id', wrap(async (req, res) => res.json(await getProduct(req.params.id, true))));

module.exports = router;
