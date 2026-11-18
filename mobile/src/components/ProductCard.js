import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import FavoriteButton from './FavoriteButton';
import Photo from './Photo';
import { money } from '@/utils/format';
import { colors, space } from '@/utils/theme';

export default function ProductCard({ product, width, onPress }) {
  const price = product.min_price ?? product.base_price;
  const soldOut = Number(product.total_stock) <= 0;
  // Giá gạch ngang + nhãn giảm giá khi biến thể rẻ nhất có giá gốc cao hơn
  const compare = Number(product.compare_at_price) > Number(price) ? Number(product.compare_at_price) : null;
  const off = compare ? Math.round((1 - Number(price) / compare) * 100) : 0;
  const rated = Number(product.rating_count) > 0;
  return (
    <Pressable onPress={onPress} style={{ width }}>
      <Card>
        <View>
          <Photo uri={product.thumbnail} style={{ width: '100%', aspectRatio: 3 / 4 }} />
          {soldOut ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Hết hàng</Text>
            </View>
          ) : off > 0 ? (
            <View style={[styles.badge, styles.sale]}>
              <Text style={styles.badgeText}>-{off}%</Text>
            </View>
          ) : null}
          <FavoriteButton productId={product.id} style={styles.heart} />
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {product.name}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{money(price)}</Text>
            {compare ? <Text style={styles.compare}>{money(compare)}</Text> : null}
          </View>
          {rated ? (
            <View style={styles.rating}>
              <Ionicons name="star" size={12} color="#F5A623" />
              <Text style={styles.ratingText}>{Number(product.rating_avg).toFixed(1)} ({product.rating_count})</Text>
            </View>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  info: { padding: space.md, gap: 4 },
  name: { fontSize: 14, color: colors.text, minHeight: 36, lineHeight: 18 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  price: { fontSize: 15, fontWeight: '700', color: colors.primary },
  compare: { fontSize: 12, color: colors.muted, textDecorationLine: 'line-through' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 12, color: colors.muted },
  heart: { position: 'absolute', top: 8, right: 8 },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  sale: { backgroundColor: colors.danger },
  badgeText: { color: colors.white, fontSize: 12, fontWeight: '600' },
});
