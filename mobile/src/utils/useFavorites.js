import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errMsg } from '@/api/client';
import { addFavorite, fetchFavoriteIds, removeFavorite } from '@/api/favorites';
import { useAuth } from '@/auth/AuthProvider';
import { FAVORITES_KEY } from './queryKeys';

const IDS_KEY = [...FAVORITES_KEY, 'ids'];

// Danh sách id sản phẩm đã thích (chỉ tải khi đã đăng nhập): mọi thẻ sản phẩm dùng chung một truy vấn này để tô trái tim
export function useFavoriteIds() {
  const { status } = useAuth();
  return useQuery({ queryKey: IDS_KEY, queryFn: fetchFavoriteIds, enabled: status === 'authenticated', staleTime: 60 * 1000 });
}

// { isFav(id), toggle(id) }: bấm tim đổi ngay trên màn hình (cập nhật lạc quan), lỗi thì hoàn lại và báo
export function useFavorites() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { status } = useAuth();
  const ids = useFavoriteIds();

  const mutation = useMutation({
    mutationFn: ({ id, on }) => (on ? addFavorite(id) : removeFavorite(id)),
    onMutate: async ({ id, on }) => {
      await queryClient.cancelQueries({ queryKey: IDS_KEY });
      const prev = queryClient.getQueryData(IDS_KEY) ?? [];
      queryClient.setQueryData(IDS_KEY, on ? [id, ...prev.filter((x) => x !== id)] : prev.filter((x) => x !== id));
      return { prev };
    },
    onError: (e, _vars, ctx) => {
      queryClient.setQueryData(IDS_KEY, ctx?.prev ?? []);
      Alert.alert('Không cập nhật được mục yêu thích', errMsg(e));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: FAVORITES_KEY });
    },
  });

  const isFav = (id) => (ids.data ?? []).includes(Number(id));
  const toggle = (id) => {
    if (status !== 'authenticated') {
      Alert.alert('Cần đăng nhập', 'Hãy đăng nhập hoặc tạo tài khoản để lưu sản phẩm yêu thích.', [
        { text: 'Để sau', style: 'cancel' },
        { text: 'Đăng nhập', onPress: () => router.push('/login') },
      ]);
      return;
    }
    mutation.mutate({ id: Number(id), on: !isFav(id) });
  };
  return { isFav, toggle };
}
