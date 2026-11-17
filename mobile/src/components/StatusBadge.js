import { StyleSheet, Text, View } from 'react-native';
import { orderStatus } from '@/utils/orderStatus';

// Nhãn trạng thái đơn hàng có màu
export default function StatusBadge({ status }) {
  const s = orderStatus(status);
  return (
    <View style={[styles.box, { backgroundColor: s.bg }]}>
      <Text style={[styles.text, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  text: { fontSize: 12, fontWeight: '700' },
});
