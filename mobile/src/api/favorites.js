import api from './client';

// GET /favorites/ids -> [productId, ...] (mới thích trước)
export const fetchFavoriteIds = () => api.get('/favorites/ids').then((r) => r.data);

// GET /favorites?page=&limit= -> { data: [sản phẩm cùng dạng với danh sách cửa hàng + favorited_at], page, limit, total }
export const fetchFavorites = ({ page, limit }) => api.get('/favorites', { params: { page, limit } }).then((r) => r.data);

// PUT /favorites/:productId (thích, lặp lại vẫn một dòng) và DELETE (bỏ thích)
export const addFavorite = (productId) => api.put(`/favorites/${productId}`).then((r) => r.data);
export const removeFavorite = (productId) => api.delete(`/favorites/${productId}`).then((r) => r.data);
