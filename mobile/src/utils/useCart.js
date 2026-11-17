import { useQuery } from '@tanstack/react-query';
import { fetchCart } from '@/api/cart';
import { useAuth } from '@/auth/AuthProvider';
import { ADDRESSES_KEY, CART_KEY, ORDERS_KEY, PRODUCTS_KEY, PRODUCT_KEY, QUOTE_KEY, orderKey } from './queryKeys';

// Giữ export cũ để các màn đã viết không phải đổi import
export { ADDRESSES_KEY, CART_KEY, QUOTE_KEY };

// Giỏ hàng cần đăng nhập: khách chưa đăng nhập thì không gọi API (tránh 401), cart = undefined
export const useCart = (options) => {
  const { status } = useAuth();
  return useQuery({ queryKey: CART_KEY, queryFn: fetchCart, ...options, enabled: status === 'authenticated' && (options?.enabled ?? true) });
};

// Số "món" (dòng hàng) trong giỏ - dùng cho badge trên tab
export const cartLineCount = (cart) => cart?.items?.length ?? 0;

// Chữ ký nội dung giỏ: đổi khi thêm/xóa/đổi số lượng -> khóa của /orders/quote đổi theo và tự tính lại
export const cartSignature = (cart) => (cart?.items ?? []).map((i) => `${i.variant_id}:${i.quantity}`).join(',');

// Backend KHÔNG giới hạn số lượng trong giỏ theo tồn kho, nên app tự phát hiện:
//   'out'  = hết hàng (stock <= 0)      'over' = số lượng trong giỏ vượt tồn kho
//   'gone' = sản phẩm đã ngừng bán (goneId = mã biến thể mà /orders/quote báo "không còn bán"; giỏ không trả cờ này)
export function lineIssue(item, goneId = null) {
  if (goneId != null && item.variant_id === goneId) return 'gone';
  const stock = Number(item.stock);
  if (stock <= 0) return 'out';
  if (item.quantity > stock) return 'over';
  return null;
}

export const cartIssueCount = (cart, goneId = null) => (cart?.items ?? []).filter((i) => lineIssue(i, goneId)).length;

// Gọi sau khi đặt hàng thành công. Giỏ cũ đã chuyển sang CONVERTED nên giỏ hiện tại trống;
// tồn kho đã đổi nên danh sách / chi tiết sản phẩm cũng phải tải lại; mã giảm giá có thể đã hết lượt.
export function afterOrderPlaced(queryClient) {
  queryClient.setQueryData(CART_KEY, (old) => (old ? { ...old, items: [], subtotal: 0 } : old));
  queryClient.invalidateQueries({ queryKey: CART_KEY });
  queryClient.removeQueries({ queryKey: QUOTE_KEY });
  queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
  queryClient.invalidateQueries({ queryKey: PRODUCT_KEY });
  queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
}

// Gọi sau khi hủy đơn: tồn kho được backend hoàn lại nên sản phẩm cũng phải tải lại
export function afterOrderCancelled(queryClient, orderId) {
  queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
  queryClient.invalidateQueries({ queryKey: orderKey(orderId) });
  queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
  queryClient.invalidateQueries({ queryKey: PRODUCT_KEY });
}
