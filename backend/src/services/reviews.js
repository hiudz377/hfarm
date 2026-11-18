// Đánh giá sản phẩm: khách chỉ đánh giá được món trong đơn ĐÃ HOÀN THÀNH (mỗi dòng hàng một lần);
// đánh giá mới ở trạng thái PENDING, nhân viên duyệt (APPROVED) thì mới hiện công khai.
const db = require('../db');
const { httpError, paging, tx } = require('../utils');

const REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

// "Nguyễn Văn An" -> "Nguyễn V. A."; một từ -> "A***"; trống -> "Khách hàng". Không lộ tên đầy đủ hay email.
function maskName(fullName) {
  const words = String(fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'Khách hàng';
  if (words.length === 1) return `${[...words[0]][0]}***`;
  return `${words[0]} ${words.slice(1).map((w) => `${[...w][0].toUpperCase()}.`).join(' ')}`;
}

async function reviewSummary(productId) {
  const [[r]] = await db.query(
    `SELECT COUNT(*) AS count, ROUND(AVG(rating), 1) AS average,
            COALESCE(SUM(rating = 1), 0) AS r1, COALESCE(SUM(rating = 2), 0) AS r2, COALESCE(SUM(rating = 3), 0) AS r3,
            COALESCE(SUM(rating = 4), 0) AS r4, COALESCE(SUM(rating = 5), 0) AS r5
     FROM reviews WHERE product_id = ? AND status = 'APPROVED'`, [productId]);
  return {
    count: Number(r.count), average: r.average === null ? null : Number(r.average),
    distribution: { 1: Number(r.r1), 2: Number(r.r2), 3: Number(r.r3), 4: Number(r.r4), 5: Number(r.r5) },
  };
}

// Đánh giá công khai của một sản phẩm (chỉ APPROVED), mới nhất trước
async function listReviews(productId, query) {
  const [[p]] = await db.query("SELECT id FROM products WHERE id = ? AND status = 'ACTIVE'", [productId]);
  if (!p) throw httpError(404, 'Không tìm thấy sản phẩm');
  const { page, limit, offset } = paging(query);
  const [rows] = await db.query(
    `SELECT r.id, r.rating, r.comment, r.created_at, u.full_name
     FROM reviews r JOIN users u ON u.id = r.user_id
     WHERE r.product_id = ? AND r.status = 'APPROVED' ORDER BY r.id DESC LIMIT ? OFFSET ?`,
    [productId, limit, offset]);
  const summary = await reviewSummary(productId);
  return {
    summary,
    data: rows.map(({ full_name, ...r }) => ({ ...r, reviewer_name: maskName(full_name) })),
    page, limit, total: summary.count,
  };
}

// body: { order_item_id, rating (1-5), comment? (tối đa 1000 ký tự) }
async function createReview(userId, body) {
  const orderItemId = Number(body.order_item_id);
  const rating = Number(body.rating);
  if (!Number.isSafeInteger(orderItemId) || orderItemId < 1) throw httpError(400, 'Thiếu sản phẩm cần đánh giá');
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw httpError(400, 'Số sao phải từ 1 đến 5');
  const comment = body.comment == null ? '' : String(body.comment).trim();
  if (comment.length > 1000) throw httpError(400, 'Nhận xét tối đa 1000 ký tự');

  return tx(async (conn) => {
    // Khóa dòng hàng để hai lần gửi cùng lúc không tạo hai đánh giá
    const [items] = await conn.query(
      `SELECT oi.id, o.user_id, o.status, pv.product_id
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       LEFT JOIN product_variants pv ON pv.id = oi.variant_id
       WHERE oi.id = ? FOR UPDATE`, [orderItemId]);
    const item = items[0];
    if (!item || item.user_id !== userId) throw httpError(404, 'Không tìm thấy sản phẩm trong đơn hàng');
    if (item.status !== 'COMPLETED') throw httpError(400, 'Chỉ đánh giá được sau khi đơn hàng hoàn thành');
    if (!item.product_id) throw httpError(400, 'Sản phẩm này không còn để đánh giá');
    const [dup] = await conn.query('SELECT id FROM reviews WHERE order_item_id = ? LIMIT 1', [orderItemId]);
    if (dup.length) throw httpError(409, 'Bạn đã đánh giá sản phẩm này trong đơn hàng này');
    const [r] = await conn.query(
      'INSERT INTO reviews (user_id, product_id, order_item_id, rating, comment) VALUES (?,?,?,?,?)',
      [userId, item.product_id, orderItemId, rating, comment || null]);
    return { id: r.insertId, status: 'PENDING' };
  });
}

module.exports = { REVIEW_STATUSES, maskName, reviewSummary, listReviews, createReview };
