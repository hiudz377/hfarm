const db = require('../db');
const { paging, httpError } = require('../utils');

// Giá hiển thị/lọc/sắp xếp của một sản phẩm = giá thấp nhất trong các biến thể đang bán (không có thì lấy giá gốc)
const PRICE = '(COALESCE((SELECT MIN(price) FROM product_variants WHERE product_id = p.id AND is_active = 1), p.base_price))';
// Tổng số lượng đã bán (bỏ đơn hủy/hoàn trả, cùng cách tính với top_products ở /admin/stats)
const SOLD = `(SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi
   JOIN orders o ON o.id = oi.order_id JOIN product_variants pv ON pv.id = oi.variant_id
   WHERE pv.product_id = p.id AND o.status NOT IN ('CANCELLED', 'RETURNED'))`;

// ?sort= : chỉ nhận các giá trị trong danh sách này (không bao giờ ghép chuỗi người dùng vào SQL). p.id DESC để thứ tự ổn định khi phân trang.
const SORTS = {
  newest: 'p.id DESC',
  price_asc: `${PRICE} ASC, p.id DESC`,
  price_desc: `${PRICE} DESC, p.id DESC`,
  bestseller: `${SOLD} DESC, p.id DESC`,
};

// "1,2,3" hoặc ?x=1&x=2 -> [1, 2, 3]. Rỗng/không có -> []. Sai định dạng -> 400.
function idList(value, label) {
  if (value === undefined || value === null || value === '') return [];
  const parts = String(value).split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length > 50 || !parts.every((s) => /^\d{1,18}$/.test(s))) throw httpError(400, `Giá trị ${label} không hợp lệ`);
  return [...new Set(parts.map(Number))];
}

function priceParam(value, label) {
  if (value === undefined || value === null || value === '') return null;
  if (!/^\d{1,12}(\.\d+)?$/.test(String(value))) throw httpError(400, `Giá trị ${label} không hợp lệ`);
  return Number(value);
}

const marks = (list) => list.map(() => '?').join(',');

// Danh sách sản phẩm có lọc + sắp xếp + phân trang. onlyActive = true cho khách hàng.
// Bộ lọc: q, category_id, brand_id (nhiều giá trị cách nhau dấu phẩy), min_price, max_price,
//         size_id, color_id (nhiều giá trị), in_stock=1. size/color/còn hàng phải cùng khớp MỘT biến thể đang bán.
async function listProducts(q, onlyActive) {
  const { page, limit, offset } = paging(q);
  const sort = q.sort === undefined || q.sort === '' ? 'newest' : String(q.sort);
  if (!Object.hasOwn(SORTS, sort)) throw httpError(400, `Kiểu sắp xếp không hợp lệ: ${sort}`);

  const where = [];
  const params = [];
  if (onlyActive) where.push("p.status = 'ACTIVE'");
  else if (q.status) { where.push('p.status = ?'); params.push(q.status); }
  if (q.q) { where.push('p.name LIKE ?'); params.push(`%${q.q}%`); }
  if (q.category_id) { where.push('p.category_id = ?'); params.push(q.category_id); }

  const brandIds = idList(q.brand_id, 'brand_id');
  if (brandIds.length) { where.push(`p.brand_id IN (${marks(brandIds)})`); params.push(...brandIds); }

  const minPrice = priceParam(q.min_price, 'min_price');
  const maxPrice = priceParam(q.max_price, 'max_price');
  if (minPrice !== null) { where.push(`${PRICE} >= ?`); params.push(minPrice); }
  if (maxPrice !== null) { where.push(`${PRICE} <= ?`); params.push(maxPrice); }

  const sizeIds = idList(q.size_id, 'size_id');
  const colorIds = idList(q.color_id, 'color_id');
  const inStock = q.in_stock === '1' || q.in_stock === 'true';
  if (sizeIds.length || colorIds.length || inStock) {
    const cond = ['v.product_id = p.id', 'v.is_active = 1'];
    if (sizeIds.length) { cond.push(`v.size_id IN (${marks(sizeIds)})`); params.push(...sizeIds); }
    if (colorIds.length) { cond.push(`v.color_id IN (${marks(colorIds)})`); params.push(...colorIds); }
    if (inStock) cond.push('COALESCE(i.quantity, 0) > 0');
    where.push(`EXISTS (SELECT 1 FROM product_variants v LEFT JOIN inventories i ON i.variant_id = v.id WHERE ${cond.join(' AND ')})`);
  }
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
     ${w} ORDER BY ${SORTS[sort]} LIMIT ? OFFSET ?`,
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
