import api from './client';

// POST /orders/quote { coupon_code?, address_id? } (lấy hàng từ giỏ)
// -> { subtotal, discount_amount, shipping_fee, total_amount, shipping_zone: { zone_name, eta_min_days, eta_max_days, free_over } }
// Có addressId thì phí ship theo vùng của địa chỉ đó; không có thì vùng mặc định.
// Không ghi DB, không kiểm tra tồn kho. Mã sai/hết hạn -> lỗi 400 với thông báo tiếng Việt.
export const quoteOrder = ({ couponCode, addressId }) =>
  api.post('/orders/quote', { coupon_code: couponCode || undefined, address_id: addressId || undefined }).then((r) => r.data);

// POST /orders { address_id, payment_method, coupon_code?, customer_note? } (lấy hàng từ giỏ)
// -> { id, order_code, subtotal, discount_amount, shipping_fee, total_amount, shipping_zone }
// timeout dài hơn mặc định: đặt hàng chạy transaction trừ kho nên có thể chậm hơn
export const createOrder = ({ addressId, paymentMethod, couponCode, note }) =>
  api
    .post(
      '/orders',
      {
        address_id: addressId,
        payment_method: paymentMethod,
        coupon_code: couponCode || undefined,
        customer_note: note || undefined,
      },
      { timeout: 20000 },
    )
    .then((r) => r.data);

// GET /orders?status=&page=&limit= -> mảng (không có tổng):
// [{ id, order_code, total_amount, status, payment_status, created_at, item_count, first_product_name }]
// status: một trạng thái hoặc nhiều trạng thái cách nhau dấu phẩy
export const fetchOrders = ({ status, page, limit }) =>
  api.get('/orders', { params: { status: status || undefined, page, limit } }).then((r) => r.data);

// GET /orders/:id -> { ...đơn, items: [...], history: [...], payment, shipment }
export const fetchOrder = (id) => api.get(`/orders/${id}`).then((r) => r.data);

// GET /orders/:id/payment (đơn chuyển khoản) -> { order_code, payment_status, amount, seconds_left, expired, payable,
//   bank: { bank_name, account_no, account_name }, transfer_content, qr_payload, qr_image (ảnh PNG dạng data URL) }
// Hết hạn / đã trả / đã hủy thì payable = false và không có qr_image.
export const fetchPaymentInfo = (id) => api.get(`/orders/${id}/payment`).then((r) => r.data);

// GET /orders/:id/tracking -> { order_status, shipment: { carrier, tracking_code, status } | null,
//   timeline: [{ id, at, kind: 'status' | 'payment' | 'event', title, note?, location? }] } (mới nhất trước)
export const fetchTracking = (id) => api.get(`/orders/${id}/tracking`).then((r) => r.data);

// POST /orders/:id/cancel (chỉ đơn PENDING; backend hoàn kho) -> { message }
export const cancelOrder = (id) => api.post(`/orders/${id}/cancel`, {}).then((r) => r.data);
