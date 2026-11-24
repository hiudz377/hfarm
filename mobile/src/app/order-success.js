import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '@/components/Button';
import Card from '@/components/Card';
import PaymentQR from '@/components/PaymentQR';
import { money } from '@/utils/format';
import { goToTab } from '@/utils/nav';
import { paymentLabel } from '@/utils/payment';
import { colors, space } from '@/utils/theme';

// Mở bằng router.replace từ màn Thanh toán, kèm ?id=&code=&total=&method=&eta=
// Chuyển khoản: hiện ngay mã QR (PaymentQR tự đếm ngược hạn trả và cập nhật khi tiền về)
export default function OrderSuccess() {
  const { id, code, total, method, eta } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bank = method === 'BANK_TRANSFER';

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={styles.tick}>
            <Ionicons name="checkmark" size={44} color={colors.white} />
          </View>
          <Text style={styles.title}>Đặt hàng thành công!</Text>
          <Text style={styles.sub}>Cảm ơn bạn đã mua sắm tại HFarm.</Text>
        </View>

        <Card style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Mã đơn hàng</Text>
            <Text style={styles.code} selectable>{code}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tổng thanh toán</Text>
            <Text style={styles.value}>{money(total)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Thanh toán</Text>
            <Text style={[styles.value, styles.right]}>{paymentLabel(method)}</Text>
          </View>
          {eta ? (
            <View style={styles.row}>
              <Text style={styles.label}>Giao hàng</Text>
              <Text style={[styles.value, styles.right]}>Dự kiến {eta}</Text>
            </View>
          ) : null}
        </Card>

        {bank && id ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Thanh toán chuyển khoản</Text>
            <PaymentQR orderId={String(id)} />
          </Card>
        ) : (
          <Text style={styles.note}>Cửa hàng sẽ liên hệ xác nhận đơn hàng. Bạn thanh toán khi nhận hàng.</Text>
        )}
        {bank ? <Text style={styles.note}>Bạn có thể thanh toán sau trong mục Đơn hàng, miễn là còn trong thời hạn.</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Button title="Tiếp tục mua sắm" variant="outline" style={styles.footerBtn} onPress={() => goToTab(router, '/shop')} />
        <Button title="Xem đơn hàng" style={styles.footerBtn} onPress={() => goToTab(router, '/orders')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: space.lg, gap: space.lg },
  hero: { alignItems: 'center', gap: 6, paddingVertical: space.xl },
  tick: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  sub: { fontSize: 14, color: colors.muted },
  card: { padding: space.lg, gap: space.md },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md },
  label: { fontSize: 14, color: colors.muted },
  value: { fontSize: 14, fontWeight: '700', color: colors.text, flexShrink: 1 },
  right: { textAlign: 'right' },
  code: { fontSize: 16, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 },
  note: { fontSize: 13, color: colors.muted, lineHeight: 19, textAlign: 'center' },
  footer: { flexDirection: 'row', padding: space.lg, paddingTop: space.md, gap: space.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  footerBtn: { flex: 1, paddingHorizontal: space.md },
});
