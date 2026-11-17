import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from './Button';
import { colors } from '@/utils/theme';

// Dùng cho trạng thái trống và cả trạng thái lỗi (truyền actionLabel + onAction để có nút "Thử lại")
export default function EmptyState({ icon = 'cube-outline', title, message, actionLabel, onAction }) {
  return (
    <View style={styles.box}>
      <Ionicons name={icon} size={56} color={colors.border} />
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel ? <Button title={actionLabel} onPress={onAction} variant="outline" style={styles.btn} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  title: { fontSize: 17, fontWeight: '600', color: colors.text, textAlign: 'center', marginTop: 4 },
  message: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  btn: { marginTop: 12, minWidth: 140 },
});
