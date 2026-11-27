import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Photo from './Photo';
import QuantityStepper from './QuantityStepper';
import { lineIssue } from '@/utils/useCart';
import { money } from '@/utils/format';
import { colors, radius, shadow, space } from '@/utils/theme';

// Một dòng trong giỏ. busy: đang gọi API (khóa nút để không gửi chồng yêu cầu).
export default function CartItemRow({ item, busy, goneId = null, onOpen, onChangeQty, onRemove }) {
  const issue = lineIssue(item, goneId);
  const stock = Number(item.stock);
  return (
    <View style={[styles.row, issue && styles.rowIssue]}>
      <Pressable onPress={onOpen}>
        <Photo uri={item.image_url} style={styles.photo} whole />
      </Pressable>
      <View style={styles.info}>
        <Pressable onPress={onOpen}>
          <Text style={styles.name} numberOfLines={2}>{item.product_name}</Text>
        </Pressable>
        <Text style={styles.variant}>{[item.color_name, item.size_name].filter(Boolean).join(' / ')}</Text>
        <Text style={styles.price}>{money(item.price)}</Text>

        {issue === 'gone' ? (
          <Text style={styles.warn}>Đã ngừng bán - vui lòng xóa khỏi giỏ</Text>
        ) : issue === 'out' ? (
          <Text style={styles.warn}>Hết hàng - vui lòng xóa khỏi giỏ</Text>
        ) : issue === 'over' ? (
          <View style={styles.warnRow}>
            <Text style={styles.warn}>Chỉ còn {stock} sản phẩm</Text>
            <Pressable onPress={() => onChangeQty(stock)} disabled={busy} hitSlop={8}>
              <Text style={styles.fix}>Đổi về {stock}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.bottom}>
          <QuantityStepper
            value={item.quantity}
            max={Math.max(stock, 1)}
            disabled={busy || issue === 'out' || issue === 'gone'}
            onChange={onChangeQty}
          />
          <Pressable onPress={onRemove} disabled={busy} hitSlop={10} style={[styles.trash, busy && styles.off]} role="button" aria-label="Xóa khỏi giỏ hàng">
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.card,
  },
  rowIssue: { borderColor: colors.danger, borderWidth: 1 },
  photo: { width: 80, height: 106, borderRadius: radius.md },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 18 },
  variant: { fontSize: 13, color: colors.muted },
  price: { fontSize: 15, fontWeight: '800', color: colors.text },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  warn: { fontSize: 13, color: colors.danger },
  fix: { fontSize: 13, color: colors.primary, fontWeight: '600', textDecorationLine: 'underline' },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm },
  trash: { padding: 6 },
  off: { opacity: 0.4 },
});
