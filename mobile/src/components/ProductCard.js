import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FavoriteButton from './FavoriteButton';
import Photo from './Photo';
import { money } from '@/utils/format';
import { colors, radius, space } from '@/utils/theme';

const NEW_DAYS = 14;
const isNewProduct = (createdAt) => !!createdAt && Date.now() - new Date(createdAt).getTime() < NEW_DAYS * 24 * 3600 * 1000;

// Thẻ sản phẩm kiểu cửa hàng thời trang: ảnh lớn bo góc, chữ nằm dưới ảnh (không khung), nhãn Mới / -% / Hết hàng trên ảnh
export default function ProductCard({ product, width, onPress }) {
  const price = product.min_price ?? product.base_price;
  const soldOut = Number(product.total_stock) <= 0;
  // Giá gạch ngang + nhãn giảm giá khi biến thể rẻ nhất có giá gốc cao hơn
  const compare = Number(product.compare_at_price) > Number(price) ? Number(product.compare_at_price) : null;
  const off = compare ? Math.round((1 - Number(price) / compare) * 100) : 0;
  const rated = Number(product.rating_count) > 0;
  const fresh = !soldOut && off === 0 && isNewProduct(product.created_at);
  const tag = product.brand_name || product.category_name;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width }, pressed && styles.pressed]} role="link" aria-label={product.name}>
      <View style={styles.imageWrap}>
        <Photo uri={product.thumbnail} style={styles.image} />
        {soldOut ? (
          <View style={styles.soldOut}>
            <Text style={styles.soldOutText}>Hết hàng</Text>
          </View>
        ) : null}
        {!soldOut && off > 0 ? (
          <View style={[styles.badge, styles.sale]}>
            <Text style={styles.badgeText}>-{off}%</Text>
          </View>
        ) : null}
        {fresh ? (
          <View style={[styles.badge, styles.fresh]}>
            <Text style={styles.badgeText}>Mới</Text>
          </View>
        ) : null}
        <FavoriteButton productId={product.id} style={styles.heart} />
      </View>
      <View style={styles.info}>
        {tag ? <Text style={styles.tag} numberOfLines={1}>{tag}</Text> : null}
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <View style={styles.priceRow}>
          <Text style={[styles.price, compare && styles.priceSale]}>{money(price)}</Text>
          {compare ? <Text style={styles.compare}>{money(compare)}</Text> : null}
        </View>
        {rated ? (
          <View style={styles.rating}>
            <Ionicons name="star" size={12} color={colors.gold} />
            <Text style={styles.ratingText}>{Number(product.rating_avg).toFixed(1)} ({product.rating_count})</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.88 },
  imageWrap: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#EDEBE4' },
  image: { width: '100%', aspectRatio: 3 / 4 },
  info: { paddingTop: space.sm, gap: 3 },
  tag: { fontSize: 11, color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: '600' },
  name: { fontSize: 14, color: colors.text, lineHeight: 19, minHeight: 38, fontWeight: '500' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  price: { fontSize: 15, fontWeight: '800', color: colors.text },
  priceSale: { color: colors.sale },
  compare: { fontSize: 12, color: colors.muted, textDecorationLine: 'line-through' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 12, color: colors.muted },
  heart: { position: 'absolute', top: 8, right: 8 },
  badge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sale: { backgroundColor: colors.sale },
  fresh: { backgroundColor: colors.primary },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  soldOut: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(247,246,242,0.62)', alignItems: 'center', justifyContent: 'center' },
  soldOutText: {
    backgroundColor: colors.text, color: colors.white, fontSize: 12, fontWeight: '700',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, overflow: 'hidden',
  },
});
