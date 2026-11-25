import { useQuery } from '@tanstack/react-query';
import { fetchStore } from '@/api/store';

export const STORE_KEY = ['store'];

// Dùng khi chưa tải được thông tin cửa hàng (đang tải hoặc mất mạng): chính sách vẫn hiện được, chỉ không có nút liên hệ.
export const DEFAULT_STORE = { name: 'HFarm', phone: null, zalo: null, email: null, address: null, hours: null, return_days: 7 };

// Thông tin cửa hàng (liên hệ, số ngày đổi trả). Ít đổi nên giữ 10 phút.
// `store` luôn có giá trị (DEFAULT_STORE khi chưa tải được); `loaded` = đã lấy được từ server.
export function useStore() {
  const q = useQuery({ queryKey: STORE_KEY, queryFn: fetchStore, staleTime: 10 * 60 * 1000 });
  return { store: q.data ?? DEFAULT_STORE, loaded: !!q.data, isPending: q.isPending, isError: q.isError && !q.data, refetch: q.refetch };
}
