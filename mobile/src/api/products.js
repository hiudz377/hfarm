import api from './client';
import { filterParams } from '@/utils/productFilters';

// GET /categories -> [{ id, name, ... }]
export const fetchCategories = () => api.get('/categories').then((r) => r.data);
// GET /sizes -> [{ id, name, sort_order }] (đã sắp theo sort_order); /colors -> [{ id, name, hex_code }]; /brands -> [{ id, name }]
export const fetchSizes = () => api.get('/sizes').then((r) => r.data);
export const fetchColors = () => api.get('/colors').then((r) => r.data);
export const fetchBrands = () => api.get('/brands').then((r) => r.data);

// GET /products?q=&category_id=&sort=&min_price=&max_price=&size_id=&color_id=&brand_id=&in_stock=&page=&limit=
//   -> { data, page, limit, total }.  filters: state của src/utils/productFilters.js
export const fetchProducts = ({ q, categoryId, filters, page, limit }) =>
  api
    .get('/products', {
      params: { q: q || undefined, category_id: categoryId || undefined, ...(filters ? filterParams(filters) : {}), page, limit },
    })
    .then((r) => r.data);

// GET /products/:id -> { ...product, variants: [{ id, size_id, color_id, size_name, color_name, hex_code, price, stock }], images }
export const fetchProduct = (id) => api.get(`/products/${id}`).then((r) => r.data);
