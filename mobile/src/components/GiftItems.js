import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Photo from './Photo';
import { money } from '@/utils/format';
import { giftColors, serif } from '@/utils/giftTheme';
import { colors, radius, space } from '@/utils/theme';

// Nút chọn / bỏ chọn quà (viền rượu vang, chọn rồi thì đặc)
function PickButton({ picked, busy, title, doneTitle, onPress, compact = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      role="button"
      aria-pressed={picked}
      style={[styles.pick, compact && styles.pickCompact, picked && styles.pickOn, busy && styles.pickBusy]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={picked ? giftColors.white : giftColors.wine} />
      ) : (
        <Ionicons name={picked ? 'checkmark-circle' : 'gift-outline'} size={18} color={picked ? giftColors.white : giftColors.wine} />
      )}
      <Text style={[styles.pickText, picked && styles.pickTextOn]}>{picked ? doneTitle : title}</Text>
    </Pressable>
  );
}

function Variant({ item }) {
  return (
    <View style={styles.variant}>
      {item.hex_code ? <View style={[styles.dot, { backgroundColor: item.hex_code }]} /> : null}
      <Text style={styles.variantText} numberOfLines={1}>Size {item.size_name} · {item.color_name}</Text>
    </View>
  );
}

// Một món quà lẻ ("Quà chính" hoặc "Quà nhỏ kèm theo")
export function GiftPickCard({ item, picked, busy, onToggle, onOpen }) {
  return (
    <View style={styles.card}>
      <Pressable onPress={onOpen} style={styles.row} role="link" aria-label={`Xem ${item.name}`}>
        <Photo uri={item.thumbnail} style={styles.photo} whole />
        <View style={styles.info}>
          <Text style={styles.role}>{item.role_label}</Text>
          <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
          <Variant item={item} />
          <View style={styles.priceRow}>
            <Text style={[styles.price, item.compare_at_price && styles.priceSale]}>{money(item.price)}</Text>
            {item.compare_at_price ? <Text style={styles.compare}>{money(item.compare_at_price)}</Text> : null}
          </View>
          {item.reasons?.[0] ? <Text style={styles.reason} numberOfLines={2}>{item.reasons[0]}</Text> : null}
        </View>
      </Pressable>
      {item.size_note === 'NEAR' ? (
        <View style={styles.warn}>
          <Ionicons name="alert-circle-outline" size={15} color={giftColors.gold} />
          <Text style={styles.warnText}>Size gần nhất còn hàng, bạn ấy có thể cần đổi size.</Text>
        </View>
      ) : null}
      <PickButton picked={picked} busy={busy} title="Chọn làm quà" doneTitle="Đã chọn" onPress={onToggle} />
    </View>
  );
}

// Một combo quà (2-3 món). pickedSet: Set mã mẫu mã đã chọn. Bấm nút để chọn cả combo, bấm lại để bỏ cả combo.
export function GiftComboCard({ combo, index, pickedSet, busy, onToggle, onOpen }) {
  const allPicked = combo.items.every((i) => pickedSet.has(i.variant_id));
  return (
    <View style={[styles.card, styles.combo]}>
      <View style={styles.comboHead}>
        <View style={styles.ribbon}>
          <Ionicons name="sparkles" size={13} color={giftColors.wineDark} />
          <Text style={styles.ribbonText}>{index === 0 ? 'Đáng tặng nhất' : `Combo ${index + 1}`}</Text>
        </View>
        <View style={styles.totalBox}>
          <Text style={styles.total}>{money(combo.total)}</Text>
          {combo.remaining > 0 ? <Text style={styles.remain}>Còn dư {money(combo.remaining)}</Text> : null}
        </View>
      </View>
      <Text style={styles.comboTitle}>{combo.title}</Text>
      {combo.items.map((item, i) => (
        <Pressable
          key={item.variant_id}
          onPress={() => onOpen(item)}
          style={[styles.miniRow, i < combo.items.length - 1 && styles.miniBorder]}
          role="link"
          aria-label={`Xem ${item.name}`}
        >
          <Photo uri={item.thumbnail} style={styles.miniPhoto} whole />
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <Variant item={item} />
          </View>
          <Text style={styles.miniPrice}>{money(item.price)}</Text>
        </Pressable>
      ))}
      {combo.highlights?.length ? (
        <View style={styles.notes}>
          {combo.highlights.map((t) => (
            <View key={t} style={styles.note}>
              <Ionicons name="heart" size={13} color={giftColors.wine} />
              <Text style={styles.noteText}>{t}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <PickButton
        picked={allPicked}
        busy={busy}
        title={`Chọn cả combo (${combo.items.length} món)`}
        doneTitle="Đã chọn combo, bấm để bỏ"
        onPress={onToggle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: giftColors.white, borderRadius: radius.lg, padding: space.md, gap: space.md,
    borderWidth: 1, borderColor: giftColors.roseLine,
  },
  combo: { backgroundColor: giftColors.cream, borderColor: giftColors.gold + '88' },
  row: { flexDirection: 'row', gap: space.md },
  photo: { width: 84, height: 108, borderRadius: radius.md },
  info: { flex: 1, gap: 2 },
  role: { fontSize: 11, fontWeight: '800', color: giftColors.gold, letterSpacing: 0.8, textTransform: 'uppercase' },
  name: { fontSize: 14, fontWeight: '600', color: giftColors.ink, lineHeight: 19 },
  variant: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  variantText: { fontSize: 12, color: giftColors.muted, flexShrink: 1 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: giftColors.roseLine },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  price: { fontSize: 15, fontWeight: '800', color: giftColors.ink },
  priceSale: { color: colors.sale },
  compare: { fontSize: 12, color: giftColors.muted, textDecorationLine: 'line-through' },
  reason: { fontSize: 12, color: giftColors.wine, lineHeight: 16, fontStyle: 'italic' },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: space.sm, borderRadius: radius.sm, backgroundColor: giftColors.goldSoft },
  warnText: { flex: 1, fontSize: 12, color: giftColors.ink, lineHeight: 16 },
  pick: {
    minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: radius.pill, borderWidth: 1.5, borderColor: giftColors.wine, backgroundColor: giftColors.white,
  },
  pickCompact: { minHeight: 40 },
  pickOn: { backgroundColor: giftColors.wine },
  pickBusy: { opacity: 0.7 },
  pickText: { fontSize: 14, fontWeight: '800', color: giftColors.wine },
  pickTextOn: { color: giftColors.white },
  comboHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  ribbon: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.pill, backgroundColor: giftColors.goldSoft,
  },
  ribbonText: { fontSize: 12, fontWeight: '800', color: giftColors.wineDark, letterSpacing: 0.3 },
  totalBox: { alignItems: 'flex-end', flexShrink: 1 },
  total: { fontSize: 20, fontWeight: '800', color: giftColors.wine, fontFamily: serif },
  remain: { fontSize: 12, color: giftColors.muted },
  comboTitle: { fontSize: 13, color: giftColors.muted, fontStyle: 'italic', marginTop: -space.sm },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  miniBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: giftColors.roseLine },
  miniPhoto: { width: 52, height: 66, borderRadius: radius.sm },
  miniPrice: { fontSize: 13, fontWeight: '700', color: giftColors.ink },
  notes: { gap: 4 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteText: { flex: 1, fontSize: 13, color: giftColors.ink, lineHeight: 18 },
});
