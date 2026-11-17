import api from './client';

// Tất cả đều trả về chi tiết giỏ: { id, items: [{ id, variant_id, quantity, price, stock, product_id, product_name,
// size_name, color_name, image_url, sku }], subtotal }

// GET /cart
export const fetchCart = () => api.get('/cart').then((r) => r.data);

// POST /cart/items { variant_id, quantity } (đã có trong giỏ thì backend cộng dồn, KHÔNG giới hạn theo tồn kho)
export const addToCart = ({ variantId, quantity }) =>
  api.post('/cart/items', { variant_id: variantId, quantity }).then((r) => r.data);

// PUT /cart/items/:id { quantity }
export const updateCartItem = ({ itemId, quantity }) =>
  api.put(`/cart/items/${itemId}`, { quantity }).then((r) => r.data);

// DELETE /cart/items/:id
export const removeCartItem = (itemId) => api.delete(`/cart/items/${itemId}`).then((r) => r.data);
