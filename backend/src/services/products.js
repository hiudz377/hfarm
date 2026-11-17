const db = require('../db');
const { paging, httpError } = require('../utils');

// Danh sách sản phẩm có lọc + phân trang. onlyActive = true cho khách hàng
async function listProducts(q, onlyActive) {
  const { page, limit, offset } = paging(q);
  const where = [];
  const params = [];
  if (onlyActive) where.push("p.status = 'ACTIVE'");
  else if (q.status) { where.push('p.status = ?'); params.push(q.status); }
  if (q.q) { where.push('p.name LIKE ?'); params.push(`%${q.q}%`); }
  if (q.category_id) { where.push('p.category_id = ?'); params.push(q.category_id); }
  if (q.brand_id) { where.push('p.brand_id = ?'); params.push(q.brand_id); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM products p ${w}`, params);
  const [rows] = await db.query(
    `SELECT p.id, p.name, p.slug, p.base_price, p.status, p.category_id, p.brand_id, p.created_at,
       c.name AS category_name, b.name AS brand_name,
       (SELECT MIN(price) FROM product_variants WHERE product_id = p.id AND is_active = 1) AS min_price,
       (SELECT COALESCE(SUM(i.quantity), 0) FROM product_variants v
          JOIN inventories i ON i.variant_id = v.id WHERE v.product_id = p.id) AS total_stock,
       (SELECT image_url FROM product_images WHERE product_id = p.id
          ORDER BY is_primary DESC, sort_order, id LIMIT 1) AS thumbnail
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN brands b ON b.id = p.brand_id
     ${w} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return { data: rows, page, limit, total };
}

async function getProduct(id, onlyActive) {
  const [rows] = await db.query(
    `SELECT p.*, c.name AS category_name, b.name AS brand_name
     FROM products p JOIN categories c ON c.id = p.category_id
     LEFT JOIN brands b ON b.id = p.brand_id
     WHERE p.id = ? ${onlyActive ? "AND p.status = 'ACTIVE'" : ''}`, [id]);
  if (!rows.length) throw httpError(404, 'Không tìm thấy sản phẩm');
  const [variants] = await db.query(
    `SELECT v.*, s.name AS size_name, c.name AS color_name, c.hex_code,
            COALESCE(i.quantity, 0) AS stock
     FROM product_variants v
     JOIN sizes s ON s.id = v.size_id JOIN colors c ON c.id = v.color_id
     LEFT JOIN inventories i ON i.variant_id = v.id
     WHERE v.product_id = ? ${onlyActive ? 'AND v.is_active = 1' : ''}
     ORDER BY s.sort_order, c.id`, [id]);
  const [images] = await db.query(
    'SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order, id', [id]);
  return { ...rows[0], variants, images };
}

module.exports = { listProducts, getProduct };
