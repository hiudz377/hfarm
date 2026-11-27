import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from './Button';
import Card from './Card';
import Photo from './Photo';
import { money } from '@/utils/format';
import { colors, radius, space } from '@/utils/theme';

const BADGE = {
  BEST: { bg: colors.primary, fg: colors.white },
  SAVER: { bg: '#F6EBCF', fg: '#7A5A12' },
  ALT: { bg: colors.primarySoft, fg: colors.primaryDark },
};

// Một món trong bộ đồ: bấm cả dòng để xem sản phẩm, nút tròn bên phải để thêm riêng món này vào giỏ
function ItemRow({ item, last, inCart, adding, onOpen, onAdd }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Pressable onPress={onOpen} style={styles.rowMain} role="link" aria-label={`Xem ${item.name}`}>
        <Photo uri={item.thumbnail} style={styles.photo} whole />
        <View style={styles.info}>
          <Text style={styles.role}>{item.role_label}</Text>
          <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
          <View style={styles.variant}>
            {item.hex_code ? <View style={[styles.dot, { backgroundColor: item.hex_code }]} /> : null}
            <Text style={styles.variantText} numberOfLines={1}>Size {item.size_name} · {item.color_name}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={[styles.price, item.compare_at_price && styles.priceSale]}>{money(item.price)}</Text>
            {item.compare_at_price ? <Text style={styles.compare}>{money(item.compare_at_price)}</Text> : null}
          </View>
          {item.reasons?.[0] ? <Text style={styles.reason} numberOfLines={2}>{item.reasons[0]}</Text> : null}
        </View>
      </Pressable>
      <Pressable
        onPress={onAdd}
        disabled={inCart || adding}
        hitSlop={8}
        role="button"
        aria-label={inCart ? `${item.name} đã có trong giỏ` : `Thêm ${item.name} vào giỏ`}
        style={[styles.add, inCart && styles.addDone]}
      >
        {adding ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name={inCart ? 'checkmark' : 'add'} size={22} color={inCart ? colors.white : colors.primary} />
        )}
      </Pressable>
    </View>
  );
}

// Một bộ đồ gợi ý: các món, tổng tiền so với ngân sách, lý do hợp, và nút mua cả bộ hoặc từng món.
// inCart: Set mã mẫu mã đã có trong giỏ. addingKey: 'all:<key bộ>' hoặc 'one:<mã mẫu mã>' đang được thêm.
export default function OutfitCard({ outfit, inCart, addingKey, onAddAll, onAddOne, onOpen }) {
  const badge = BADGE[outfit.key] ?? BADGE.ALT;
  const missing = outfit.items.filter((i) => !inCart.has(i.variant_id));
  const allIn = missing.length === 0;
  const someIn = !allIn && missing.length < outfit.items.length;
  const title = allIn
    ? 'Cả bộ đã có trong giỏ'
    : someIn ? `Thêm ${missing.length} món còn lại vào giỏ` : `Thêm cả bộ vào giỏ (${outfit.items.length} món)`;

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.fg }]}>{outfit.label}</Text>
        </View>
        <View style={styles.totalBox}>
          <Text style={styles.total}>{money(outfit.total)}</Text>
          {outfit.remaining > 0 ? <Text style={styles.remain}>Còn dư {money(outfit.remaining)}</Text> : null}
        </View>
      </View>

      <View style={styles.items}>
        {outfit.items.map((item, i) => (
          <ItemRow
            key={item.variant_id}
            item={item}
            last={i === outfit.items.length - 1}
            inCart={inCart.has(item.variant_id)}
            adding={addingKey === `one:${item.variant_id}` || addingKey === `all:${outfit.key}`}
            onOpen={() => onOpen(item)}
            onAdd={() => onAddOne(item)}
          />
        ))}
      </View>

      {outfit.highlights?.length || outfit.skipped?.length ? (
        <View style={styles.notes}>
          {outfit.highlights.map((text) => (
            <View key={text} style={styles.note}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              <Text style={styles.noteText}>{text}</Text>
            </View>
          ))}
          {outfit.skipped.map((s) => (
            <View key={s.role} style={styles.note}>
              <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
              <Text style={[styles.noteText, styles.noteMuted]}>
                {s.reason === 'OVER_BUDGET'
                  ? `Muốn thêm ${s.role_label.toLowerCase()} cho bộ này, cần ngân sách từ ${money(s.need_budget)}`
                  : `Cửa hàng chưa có ${s.role_label.toLowerCase()} phù hợp với bạn`}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.foot}>
        <Button
          title={title}
          icon={allIn ? 'checkmark-circle-outline' : 'bag-add-outline'}
          variant={allIn ? 'soft' : 'primary'}
          disabled={allIn}
          loading={addingKey === `all:${outfit.key}`}
          onPress={onAddAll}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, padding: space.lg, paddingBottom: space.md },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  badgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  totalBox: { alignItems: 'flex-end', flexShrink: 1 },
  total: { fontSize: 20, fontWeight: '800', color: colors.text },
  remain: { fontSize: 12, color: colors.muted },
  items: { paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowMain: { flex: 1, flexDirection: 'row', gap: space.md },
  photo: { width: 68, height: 88, borderRadius: radius.sm },
  info: { flex: 1, gap: 2 },
  role: { fontSize: 11, fontWeight: '700', color: colors.primary, letterSpacing: 0.6, textTransform: 'uppercase' },
  name: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 19 },
  variant: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  variantText: { fontSize: 12, color: colors.muted, flexShrink: 1 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  price: { fontSize: 14, fontWeight: '800', color: colors.text },
  priceSale: { color: colors.sale },
  compare: { fontSize: 12, color: colors.muted, textDecorationLine: 'line-through' },
  reason: { fontSize: 12, color: colors.primaryDark, lineHeight: 16 },
  add: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.surface,
  },
  addDone: { backgroundColor: colors.primary },
  notes: { gap: 6, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xs },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  noteText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  noteMuted: { color: colors.muted },
  foot: { padding: space.lg, paddingTop: space.md },
});
