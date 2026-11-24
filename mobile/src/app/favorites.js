import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { errMsg } from '@/api/client';
import { fetchFavorites } from '@/api/favorites';
import EmptyState from '@/components/EmptyState';
import Loading from '@/components/Loading';
import ProductCard from '@/components/ProductCard';
import { FAVORITES_KEY } from '@/utils/queryKeys';
import { goToTab } from '@/utils/nav';
import { useFavoriteIds } from '@/utils/useFavorites';
import { useFocusRefresh, usePullRefresh } from '@/utils/useRefresh';
import { colors, space } from '@/utils/theme';

const PAGE_SIZE = 12;
const GAP = space.md;

// Danh sách sản phẩm đã thả tim. Bỏ tim một thẻ thì thẻ biến mất ngay (lọc theo danh sách id đã cập nhật lạc quan).
export default function Favorites() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardWidth = (width - space.lg * 2 - GAP) / 2;
  const listKey = [...FAVORITES_KEY, 'list'];

  const q = useInfiniteQuery({
    queryKey: listKey,
    queryFn: ({ pageParam }) => fetchFavorites({ page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
  });
  useFocusRefresh(listKey);
  const ids = useFavoriteIds();
  const { refreshing, onRefresh } = usePullRefresh(q.refetch);

  const items = useMemo(() => {
    const seen = new Map();
    for (const page of q.data?.pages ?? []) for (const p of page.data) if (!seen.has(p.id)) seen.set(p.id, p);
    const still = ids.data ? new Set(ids.data) : null;
    return [...seen.values()].filter((p) => !still || still.has(p.id));
  }, [q.data, ids.data]);

  if (q.isPending) return <Loading />;
  if (q.isError && !q.data) {
    return <EmptyState icon="cloud-offline-outline" title="Không tải được danh sách yêu thích" message={errMsg(q.error)} actionLabel="Thử lại" onAction={() => q.refetch()} />;
  }
  if (!items.length) {
    return (
      <EmptyState
        icon="heart-outline"
        title="Chưa có sản phẩm yêu thích"
        message="Chạm vào biểu tượng trái tim trên sản phẩm để lưu lại xem sau."
        actionLabel="Đi mua sắm"
        onAction={() => goToTab(router, '/shop')}
      />
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(p) => String(p.id)}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => <ProductCard product={item} width={cardWidth} onPress={() => router.push(`/product/${item.id}`)} />}
      onEndReached={() => {
        if (q.hasNextPage && !q.isFetchingNextPage && !q.isFetchNextPageError) q.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListFooterComponent={
        q.isFetchingNextPage ? (
          <ActivityIndicator style={styles.footer} color={colors.primary} />
        ) : q.isFetchNextPageError ? (
          <Pressable onPress={() => q.fetchNextPage()} style={styles.footer}>
            <Text style={styles.retry}>Không tải thêm được. Chạm để thử lại</Text>
          </Pressable>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg },
  row: { gap: GAP, marginBottom: GAP },
  footer: { paddingVertical: space.lg, alignItems: 'center' },
  retry: { color: colors.primary, fontSize: 14 },
});
