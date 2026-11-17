import { StyleSheet, Text, View } from 'react-native';
import { BANK_TRANSFER, transferContent } from '@/utils/bankConfig';
import { colors, radius, space } from '@/utils/theme';

const Line = ({ label, value, strong }) => (
  <View style={styles.line}>
    <Text style={styles.label}>{label}</Text>
    <Text style={[styles.value, strong && styles.strong]} selectable>{value}</Text>
  </View>
);

// Thông tin chuyển khoản (giả định, lấy từ src/utils/bankConfig.js). orderCode chưa có thì nhắc "mã đơn".
export default function BankInfo({ orderCode }) {
  return (
    <View style={styles.box}>
      <Line label="Ngân hàng" value={BANK_TRANSFER.bankName} />
      <Line label="Số tài khoản" value={BANK_TRANSFER.accountNumber} strong />
      <Line label="Chủ tài khoản" value={BANK_TRANSFER.accountName} />
      <Line label="Chi nhánh" value={BANK_TRANSFER.branch} />
      <Line label="Nội dung" value={transferContent(orderCode)} strong />
      {!orderCode ? <Text style={styles.note}>Mã đơn hàng sẽ hiện sau khi bạn đặt hàng.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: space.md, gap: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  label: { fontSize: 13, color: colors.muted },
  value: { fontSize: 13, color: colors.text, flexShrink: 1, textAlign: 'right' },
  strong: { fontWeight: '700' },
  note: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
