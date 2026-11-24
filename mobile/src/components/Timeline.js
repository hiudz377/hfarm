import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dateTime } from '@/utils/format';
import { orderStatus } from '@/utils/orderStatus';
import { colors, space } from '@/utils/theme';

// Chuyển lịch sử đổi trạng thái (order_status_history) thành các mục của dòng thời gian.
// Dùng khi chưa tải được hành trình từ GET /orders/:id/tracking (cùng dạng dữ liệu, mới nhất trước).
export function historyToItems(history) {
  return [...(history ?? [])]
    .sort((a, b) => b.id - a.id)
    .map((h) => {
      const same = h.old_status === h.new_status;
      return {
        id: `h${h.id}`,
        at: h.created_at,
        kind: same ? 'payment' : 'status',
        status: same ? undefined : h.new_status,
        title: same ? h.note || 'Cập nhật thanh toán' : h.old_status === null ? 'Đặt hàng thành công' : orderStatus(h.new_status).label,
        note: same ? null : h.note,
      };
    });
}

// Dòng thời gian của đơn: mốc đổi trạng thái, mốc đã nhận tiền, mốc vận chuyển nhân viên ghi. Mục đầu (mới nhất) tô đậm.
// items: [{ id, at, kind: 'status' | 'payment' | 'event', status?, title, note?, location? }]
export default function Timeline({ items }) {
  if (!items?.length) return <Text style={styles.empty}>Chưa có thông tin.</Text>;
  return (
    <View>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        const tone = it.kind === 'status' ? orderStatus(it.status).color : colors.primary;
        const icon = it.kind === 'payment' ? 'wallet' : it.kind === 'event' ? 'location' : null;
        return (
          <View key={it.id} style={styles.row}>
            <View style={styles.rail}>
              {icon ? (
                <View style={[styles.iconDot, { backgroundColor: i === 0 ? tone : colors.border }]}>
                  <Ionicons name={icon} size={9} color={i === 0 ? colors.white : colors.muted} />
                </View>
              ) : (
                <View style={[styles.dot, i === 0 && { backgroundColor: tone, borderColor: tone }]} />
              )}
              {!last ? <View style={styles.line} /> : null}
            </View>
            <View style={[styles.body, !last && styles.bodyGap]}>
              <Text style={[styles.title, i === 0 && { color: tone }]}>{it.title}</Text>
              {it.location ? <Text style={styles.loc}>{it.location}</Text> : null}
              <Text style={styles.time}>{dateTime(it.at)}</Text>
              {it.note ? <Text style={styles.note}>{it.note}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 13, color: colors.muted },
  row: { flexDirection: 'row', gap: space.md },
  rail: { alignItems: 'center', width: 14 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, marginTop: 3 },
  iconDot: { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  body: { flex: 1, gap: 2 },
  bodyGap: { paddingBottom: space.md },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  loc: { fontSize: 13, color: colors.text },
  time: { fontSize: 12, color: colors.muted },
  note: { fontSize: 13, color: colors.text, lineHeight: 18 },
});
