const router = require('express').Router();
const db = require('../../db');
const { wrap, paging } = require('../../utils');

router.get('/', wrap(async (req, res) => {
  const { page, limit, offset } = paging(req.query);
  const where = [];
  const params = [];

  if (req.query.q) {
    where.push('(p.name LIKE ? OR v.sku LIKE ?)');
    params.push(`%${req.query.q}%`, `%${req.query.q}%`);
  }
  if (req.query.category_id) {
    where.push('p.category_id = ?');
    params.push(req.query.category_id);
  }
  if (req.query.low === '1') where.push('COALESCE(i.quantity, 0) <= 5');
  if (req.query.out === '1') where.push('COALESCE(i.quantity, 0) = 0');

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const joins = `FROM product_variants v
    JOIN products p ON p.id = v.product_id
    JOIN sizes s ON s.id = v.size_id
    JOIN colors c ON c.id = v.color_id
    LEFT JOIN inventories i ON i.variant_id = v.id`;
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total ${joins} ${whereSql}`, params);
  const [rows] = await db.query(
    `SELECT v.id AS variant_id, v.product_id, p.name AS product_name,
       (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id
        ORDER BY pi.is_primary DESC, pi.sort_order, pi.id LIMIT 1) AS thumbnail,
       v.sku, s.name AS size_name, c.name AS color_name, v.price,
       COALESCE(i.quantity, 0) AS stock_quantity, v.is_active
     ${joins} ${whereSql}
     ORDER BY p.name, v.sku
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]);
  const [[stats]] = await db.query(
    `SELECT COUNT(*) AS variants,
       COALESCE(SUM(COALESCE(i.quantity, 0) <= 5), 0) AS low_stock,
       COALESCE(SUM(COALESCE(i.quantity, 0) = 0), 0) AS out_of_stock
     FROM product_variants v LEFT JOIN inventories i ON i.variant_id = v.id`);

  res.json({ data: rows, page, limit, total, stats });
}));

module.exports = router;
