import api from './client';
import { filterParams } from '@/utils/productFilters';

// GET /categories -> [{ id, name, ... }]
export const fetchCategories = () => api.get('/categories').then((r) => r.data);
// Dùng cho bảng lọc: in_use=1 chỉ lấy mục đang có sản phẩm đang bán (chọn xong không bị kết quả trống).
// GET /sizes -> [{ id, name, size_group: 'LETTER' | 'NUMBER' | 'OTHER' }] đã sắp chữ -> số -> khác;
// /colors -> [{ id, name, hex_code }]; /brands -> [{ id, name }]
export const fetchSizes = () => api.get('/sizes', { params: { in_use: 1 } }).then((r) => r.data);
export const fetchColors = () => api.get('/colors', { params: { in_use: 1 } }).then((r) => r.data);
export const fetchBrands = () => api.get('/brands', { params: { in_use: 1 } }).then((r) => r.data);

// GET /products?q=&category_id=&sort=&min_price=&max_price=&size_id=&color_id=&brand_id=&in_stock=&page=&limit=
//   -> { data, page, limit, total }.  filters: state của src/utils/productFilters.js
export const fetchProducts = ({ q, categoryId, filters, page, limit }) =>
  api
    .get('/products', {
      params: { q: q || undefined, category_id: categoryId || undefined, ...(filters ? filterParams(filters) : {}), page, limit },
    })
    .then((r) => r.data);

// GET /products/suggest?q=&limit= -> [{ id, name, price, thumbnail }] (gợi ý khi gõ ô tìm kiếm)
export const fetchSuggestions = (q) => api.get('/products/suggest', { params: { q, limit: 6 } }).then((r) => r.data);

// 6 sản phẩm bán chạy nhất (gợi ý "Phổ biến" khi chưa gõ gì)
export const fetchPopular = () => api.get('/products', { params: { sort: 'bestseller', limit: 6 } }).then((r) => r.data.data);

// GET /products/:id/related?limit= -> mảng sản phẩm cùng dạng với danh sách cửa hàng
export const fetchRelated = (id) => api.get(`/products/${id}/related`, { params: { limit: 8 } }).then((r) => r.data);

// GET /products/:id -> { ...product, variants: [{ id, size_id, color_id, size_name, color_name, hex_code, price, stock }], images }
export const fetchProduct = (id) => api.get(`/products/${id}`).then((r) => r.data);
