import { Pressable, StyleSheet, Text, View } from 'react-native';
import Card from './Card';
import Photo from './Photo';
import { money } from '@/utils/format';
import { colors, space } from '@/utils/theme';

export default function ProductCard({ product, width, onPress }) {
  const price = product.min_price ?? product.base_price;
  const soldOut = Number(product.total_stock) <= 0;
  return (
    <Pressable onPress={onPress} style={{ width }}>
      <Card>
        <View>
          <Photo uri={product.thumbnail} style={{ width: '100%', aspectRatio: 3 / 4 }} />
          {soldOut ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Hết hàng</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {product.name}
          </Text>
          <Text style={styles.price}>{money(price)}</Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  info: { padding: space.md, gap: 4 },
  name: { fontSize: 14, color: colors.text, minHeight: 36, lineHeight: 18 },
  price: { fontSize: 15, fontWeight: '700', color: colors.primary },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: { color: colors.white, fontSize: 12, fontWeight: '600' },
});
