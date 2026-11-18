import api from './client';

// GET /products/:id/reviews?page=&limit=
//   -> { summary: { count, average, distribution: { 1..5 } }, data: [{ id, rating, comment, created_at, reviewer_name }], page, limit, total }
// Chỉ gồm đánh giá đã được cửa hàng duyệt.
export const fetchReviews = ({ productId, page, limit }) =>
  api.get(`/products/${productId}/reviews`, { params: { page, limit } }).then((r) => r.data);

// POST /reviews { order_item_id, rating: 1-5, comment? } -> { id, status: 'PENDING' }
// Chỉ đánh giá được món trong đơn đã hoàn thành, mỗi món một lần; hiện công khai sau khi cửa hàng duyệt.
export const createReview = ({ orderItemId, rating, comment }) =>
  api.post('/reviews', { order_item_id: orderItemId, rating, comment: comment || undefined }).then((r) => r.data);
