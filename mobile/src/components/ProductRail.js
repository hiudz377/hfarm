import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { fetchCollection } from '@/api/products';
import ProductCard from './ProductCard';
import { ProductCardSkeleton } from './Skeleton';
import { colors, space } from '@/utils/theme';

// Một dải sản phẩm ngang ở trang chủ (Hàng mới về / Bán chạy / Đang giảm giá) kèm "Xem tất cả".
// kind: 'new' | 'bestseller' | 'sale'. Mục "sale" chưa có sản phẩm nào thì ẩn hẳn.
export default function ProductRail({ title, kind, onSeeAll }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardWidth = Math.round((width - space.lg * 2) / 2.35); // chừa một phần thẻ kế tiếp để người dùng biết kéo được
  const q = useQuery({ queryKey: ['home', kind], queryFn: () => fetchCollection(kind), staleTime: 60 * 1000 });
  const items = q.data?.data ?? [];

  if (!q.isPending && !q.isError && !items.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        {items.length ? (
          <Pressable onPress={onSeeAll} hitSlop={8} style={styles.all} role="link" aria-label={`Xem tất cả ${title}`}>
            <Text style={styles.allText}>Xem tất cả</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
      {q.isPending ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => <ProductCardSkeleton key={i} width={cardWidth} />)}
        </View>
      ) : q.isError ? (
        <Pressable onPress={() => q.refetch()} style={styles.err} role="button">
          <Text style={styles.errText}>Không tải được. Chạm để thử lại</Text>
        </Pressable>
      ) : (
        <FlatList
          data={items}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <ProductCard product={item} width={cardWidth} onPress={() => router.push(`/product/${item.id}`)} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg },
  title: { fontSize: 19, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  all: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  allText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  list: { paddingHorizontal: space.lg, gap: space.md },
  err: { paddingHorizontal: space.lg },
  errText: { color: colors.primary, fontSize: 14 },
});
