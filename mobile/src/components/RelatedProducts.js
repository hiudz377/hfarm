import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fetchRelated } from '@/api/products';
import ProductCard from '@/components/ProductCard';
import { colors, space } from '@/utils/theme';

const CARD_WIDTH = 150;

// Dải ngang "Sản phẩm liên quan" (cùng danh mục, còn hàng, giá gần). Lỗi hoặc không có gì thì ẩn hẳn, không làm hỏng trang.
export default function RelatedProducts({ productId }) {
  const router = useRouter();
  const q = useQuery({ queryKey: ['related', String(productId)], queryFn: () => fetchRelated(productId), staleTime: 60 * 1000 });
  const items = q.data ?? [];
  if (!items.length) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Sản phẩm liên quan</Text>
      <FlatList
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <ProductCard product={item} width={CARD_WIDTH} onPress={() => router.push(`/product/${item.id}`)} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: space.xl, gap: space.md },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, paddingHorizontal: space.lg },
  list: { paddingHorizontal: space.lg, gap: space.md },
});
