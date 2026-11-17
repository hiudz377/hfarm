import api from './client';

// GET /categories -> [{ id, name, ... }]
export const fetchCategories = () => api.get('/categories').then((r) => r.data);

// GET /products?q=&category_id=&page=&limit= -> { data, page, limit, total }
export const fetchProducts = ({ q, categoryId, page, limit }) =>
  api
    .get('/products', { params: { q: q || undefined, category_id: categoryId || undefined, page, limit } })
    .then((r) => r.data);

// GET /products/:id -> { ...product, variants: [{ id, size_id, color_id, size_name, color_name, hex_code, price, stock }], images }
export const fetchProduct = (id) => api.get(`/products/${id}`).then((r) => r.data);
