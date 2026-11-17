import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BankInfo from '@/components/BankInfo';
import Button from '@/components/Button';
import Card from '@/components/Card';
import { money } from '@/utils/format';
import { goToTab } from '@/utils/nav';
import { paymentLabel } from '@/utils/payment';
import { colors, space } from '@/utils/theme';

// Mở bằng router.replace từ màn Thanh toán, kèm ?code=&total=&method=
export default function OrderSuccess() {
  const { code, total, method } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bank = method === 'BANK_TRANSFER';

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Ionicons name="checkmark-circle" size={84} color={colors.primary} />
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
        </Card>

        {bank ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Vui lòng chuyển khoản</Text>
            <BankInfo orderCode={String(code)} />
            <Text style={styles.note}>Ghi đúng nội dung chuyển khoản để cửa hàng đối soát. Cửa hàng sẽ liên hệ xác nhận sau khi nhận được tiền.</Text>
          </Card>
        ) : (
          <Text style={styles.note}>Cửa hàng sẽ liên hệ xác nhận đơn hàng. Bạn thanh toán khi nhận hàng.</Text>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Button title="Xem đơn hàng" onPress={() => goToTab(router, '/orders')} />
        <Button title="Về cửa hàng" variant="outline" onPress={() => goToTab(router, '/')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: space.lg, gap: space.lg },
  hero: { alignItems: 'center', gap: 6, paddingVertical: space.xl },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  sub: { fontSize: 14, color: colors.muted },
  card: { padding: space.md, gap: space.sm },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md },
  label: { fontSize: 14, color: colors.muted },
  value: { fontSize: 14, fontWeight: '600', color: colors.text, flexShrink: 1 },
  right: { textAlign: 'right' },
  code: { fontSize: 16, fontWeight: '700', color: colors.primary, letterSpacing: 0.5 },
  note: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  footer: { padding: space.lg, paddingTop: space.md, gap: space.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
});
