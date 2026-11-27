import { StyleSheet, Text, View } from 'react-native';
import { money } from '@/utils/format';
import { colors, space } from '@/utils/theme';

const Row = ({ label, value, bold, color }) => (
  <View style={styles.row}>
    <Text style={[styles.label, bold && styles.bold]}>{label}</Text>
    <Text style={[styles.value, bold && styles.total, color && { color }]}>{value}</Text>
  </View>
);

// Dùng ở Giỏ hàng, Thanh toán, Chi tiết đơn. Truyền số liệu từ /orders/quote (hoặc chỉ subtotal khi chưa có quote).
// discount = TỔNG giảm (kể cả giá mua nhóm); groupDiscount = phần giảm do mua nhóm, hiện thành dòng riêng.
export default function PriceSummary({ subtotal, discount, groupDiscount = 0, shipping, total, couponCode, dim }) {
  const couponPart = Math.max((Number(discount) || 0) - (Number(groupDiscount) || 0), 0);
  return (
    <View style={[styles.box, dim && styles.dim]}>
      <Row label="Tạm tính" value={money(subtotal)} />
      {groupDiscount > 0 ? <Row label="Giá mua nhóm" value={`-${money(groupDiscount)}`} color={colors.primary} /> : null}
      {couponPart > 0 ? <Row label={couponCode ? `Giảm giá (${couponCode})` : 'Giảm giá'} value={`-${money(couponPart)}`} color={colors.primary} /> : null}
      {shipping != null ? <Row label="Phí vận chuyển" value={shipping === 0 ? 'Miễn phí' : money(shipping)} /> : null}
      {total != null ? <Row label="Tổng cộng" value={money(total)} bold /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.sm },
  dim: { opacity: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md },
  label: { fontSize: 14, color: colors.muted, flexShrink: 1 },
  value: { fontSize: 14, color: colors.text },
  bold: { fontSize: 16, fontWeight: '700', color: colors.text },
  total: { fontSize: 18, fontWeight: '700', color: colors.primary },
});
