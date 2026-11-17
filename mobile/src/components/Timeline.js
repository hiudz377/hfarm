import { StyleSheet, Text, View } from 'react-native';
import { dateTime } from '@/utils/format';
import { orderStatus } from '@/utils/orderStatus';
import { colors, space } from '@/utils/theme';

// Dòng thời gian từ order_status_history. Hiện mới nhất ở trên; chấm đầu tiên (hiện tại) tô màu.
export default function Timeline({ history }) {
  const rows = [...(history ?? [])].sort((a, b) => b.id - a.id);
  if (!rows.length) return <Text style={styles.empty}>Chưa có lịch sử.</Text>;
  return (
    <View>
      {rows.map((h, i) => {
        const s = orderStatus(h.new_status);
        const last = i === rows.length - 1;
        return (
          <View key={h.id} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, i === 0 ? { backgroundColor: s.color, borderColor: s.color } : null]} />
              {!last ? <View style={styles.line} /> : null}
            </View>
            <View style={[styles.body, !last && styles.bodyGap]}>
              <Text style={[styles.title, i === 0 && { color: s.color }]}>{s.label}</Text>
              <Text style={styles.time}>{dateTime(h.created_at)}</Text>
              {h.note ? <Text style={styles.note}>{h.note}</Text> : null}
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
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  body: { flex: 1, gap: 2 },
  bodyGap: { paddingBottom: space.md },
  title: { fontSize: 14, fontWeight: '600', color: colors.text },
  time: { fontSize: 12, color: colors.muted },
  note: { fontSize: 13, color: colors.text, lineHeight: 18 },
});
