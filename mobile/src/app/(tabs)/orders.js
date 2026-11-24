import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { errMsg } from '@/api/client';
import { fetchOrders } from '@/api/orders';
import { useAuth } from '@/auth/AuthProvider';
import Chip from '@/components/Chip';
import EmptyState from '@/components/EmptyState';
import Loading from '@/components/Loading';
import LoginPanel from '@/components/LoginPanel';
import OrderCard from '@/components/OrderCard';
import { ORDER_FILTERS } from '@/utils/orderStatus';
import { ORDERS_KEY } from '@/utils/queryKeys';
import { useFocusRefresh, usePullRefresh } from '@/utils/useRefresh';
import { colors, space } from '@/utils/theme';

const PAGE_SIZE = 10;

// Đơn hàng thuộc về tài khoản: chưa đăng nhập thì mời đăng nhập thay vì gọi API
export default function Orders() {
  const { status } = useAuth();
  if (status !== 'authenticated') {
    return <LoginPanel title="Đăng nhập để xem đơn hàng" message="Hãy đăng nhập để xem và theo dõi các đơn bạn đã đặt." />;
  }
  return <OrdersScreen />;
}

function OrdersScreen() {
  const router = useRouter();
  const [filterKey, setFilterKey] = useState('all');
  const filter = ORDER_FILTERS.find((f) => f.key === filterKey) ?? ORDER_FILTERS[0];

  // Backend trả mảng (không có tổng): còn trang tiếp khi trang vừa tải đầy PAGE_SIZE dòng
  const orders = useInfiniteQuery({
    queryKey: [...ORDERS_KEY, { status: filter.status ?? 'all' }],
    queryFn: ({ pageParam }) => fetchOrders({ status: filter.status, page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.length >= PAGE_SIZE ? all.length + 1 : undefined),
    staleTime: 0, // trạng thái đơn đổi ở CMS: luôn tải lại khi mở
  });
  // Đơn mới ở đầu danh sách làm các trang lệch nhau: khử trùng theo id
  const items = useMemo(() => {
    const seen = new Map();
    for (const page of orders.data?.pages ?? []) for (const o of page) if (!seen.has(o.id)) seen.set(o.id, o);
    return [...seen.values()];
  }, [orders.data]);

  // Trạng thái đơn có thể đổi ở CMS: mở lại tab thì tải lại
  useFocusRefresh(ORDERS_KEY);
  const { refreshing, onRefresh } = usePullRefresh(orders.refetch);

  const loadMore = () => {
    if (orders.hasNextPage && !orders.isFetchingNextPage && !orders.isFetchNextPageError) orders.fetchNextPage();
  };

  let body;
  if (orders.isPending) {
    body = <Loading />;
  } else if (orders.isError && !items.length) {
    body = <EmptyState icon="cloud-offline-outline" title="Không tải được đơn hàng" message={errMsg(orders.error)} actionLabel="Thử lại" onAction={() => orders.refetch()} />;
  } else if (!items.length) {
    body =
      filter.key === 'all' ? (
        <EmptyState icon="receipt-outline" title="Chưa có đơn hàng nào" message="Các đơn bạn đặt sẽ hiện ở đây." actionLabel="Đi mua sắm" onAction={() => router.navigate('/shop')} />
      ) : (
        <EmptyState icon="receipt-outline" title={`Không có đơn "${filter.label}"`} message="Thử chọn bộ lọc khác." actionLabel="Xem tất cả đơn" onAction={() => setFilterKey('all')} />
      );
  } else {
    body = (
      <FlatList
        data={items}
        keyExtractor={(o) => String(o.id)}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        renderItem={({ item }) => <OrderCard order={item} onPress={() => router.push(`/order/${item.id}`)} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListFooterComponent={
          orders.isFetchingNextPage ? (
            <ActivityIndicator style={styles.footer} color={colors.primary} />
          ) : orders.isFetchNextPageError ? (
            <Pressable onPress={() => orders.fetchNextPage()} style={styles.footer}>
              <Text style={styles.retry}>Không tải thêm được. Chạm để thử lại</Text>
            </Pressable>
          ) : null
        }
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {ORDER_FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} selected={filterKey === f.key} onPress={() => setFilterKey(f.key)} />
          ))}
        </ScrollView>
      </View>
      <View style={styles.body}>{body}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  chips: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
  body: { flex: 1 },
  list: { padding: space.lg, paddingTop: space.xs },
  footer: { paddingVertical: space.lg, alignItems: 'center' },
  retry: { color: colors.primary, fontSize: 14 },
});
