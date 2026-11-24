// Khóa React Query dùng chung toàn app. Mọi nơi đọc/ghi/invalidate dữ liệu đều lấy khóa từ đây
// để các màn (badge, giỏ, thanh toán, đơn hàng, tài khoản) luôn khớp nhau.
export const CART_KEY = ['cart'];
export const QUOTE_KEY = ['quote']; // ['quote', chữ ký giỏ, mã giảm giá]
export const ADDRESSES_KEY = ['addresses'];
export const ME_KEY = ['me'];
export const ORDERS_KEY = ['orders']; // ['orders', { status }] (danh sách, phân trang)
export const orderKey = (id) => ['order', String(id)]; // chi tiết 1 đơn
export const paymentKey = (id) => ['order-payment', String(id)]; // mã QR + trạng thái thanh toán của 1 đơn chuyển khoản
export const trackingKey = (id) => ['order-tracking', String(id)]; // hành trình giao hàng của 1 đơn
export const PRODUCTS_KEY = ['products'];
export const PRODUCT_KEY = ['product']; // ['product', id]

export const FAVORITES_KEY = ['favorites']; // ['favorites', 'ids'] (mảng id) và ['favorites', 'list'] (danh sách phân trang)
export const reviewsKey = (productId) => ['reviews', String(productId)];

// Dữ liệu riêng của người dùng đang đăng nhập: bị xóa khi phiên đổi để không lộ dữ liệu của người trước
export const PRIVATE_QUERY_KEYS = [CART_KEY, QUOTE_KEY, ADDRESSES_KEY, ME_KEY, ORDERS_KEY, ['order'], ['order-payment'], ['order-tracking'], FAVORITES_KEY];
