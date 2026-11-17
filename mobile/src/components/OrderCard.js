import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import StatusBadge from './StatusBadge';
import { dateTime, money } from '@/utils/format';
import { colors, space } from '@/utils/theme';

// Thẻ đơn trong danh sách: mã, ngày, trạng thái, sản phẩm đầu + số món, tổng tiền
export default function OrderCard({ order, onPress }) {
  const count = Number(order.item_count) || 0;
  const more = count > 1 ? ` và ${count - 1} sản phẩm khác` : '';
  return (
    <Pressable onPress={onPress} role="button" aria-label={`Đơn hàng ${order.order_code}`}>
      <Card style={styles.card}>
        <View style={styles.top}>
          <View style={styles.topLeft}>
            <Text style={styles.code} numberOfLines={1}>{order.order_code}</Text>
            <Text style={styles.date}>{dateTime(order.created_at)}</Text>
          </View>
          <StatusBadge status={order.status} />
        </View>
        <Text style={styles.product} numberOfLines={2}>
          {order.first_product_name || 'Đơn hàng'}
          <Text style={styles.more}>{more}</Text>
        </Text>
        <View style={styles.bottom}>
          <Text style={styles.count}>{count} sản phẩm</Text>
          <View style={styles.totalRow}>
            <Text style={styles.total}>{money(order.total_amount)}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.md, gap: space.sm },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md },
  topLeft: { flex: 1, gap: 2 },
  code: { fontSize: 15, fontWeight: '700', color: colors.text },
  date: { fontSize: 12, color: colors.muted },
  product: { fontSize: 14, color: colors.text, lineHeight: 19 },
  more: { color: colors.muted },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { fontSize: 13, color: colors.muted },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  total: { fontSize: 16, fontWeight: '700', color: colors.primary },
});

