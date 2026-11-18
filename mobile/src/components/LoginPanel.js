import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/auth/AuthProvider';
import Button from '@/components/Button';
import { colors, radius, space } from '@/utils/theme';

// Lời mời "Đăng nhập / Tạo tài khoản" mang thương hiệu HFarm, thay cho nội dung các tab cần đăng nhập (Giỏ hàng, Đơn hàng,
// Tài khoản) khi khách chưa đăng nhập. Hai nút mở màn /login (form đăng nhập / đăng ký ngay trong app).
export default function LoginPanel({ title = 'Chào mừng đến với HFarm', message, dismissLabel, onDismiss }) {
  const router = useRouter();
  const { sessionExpired } = useAuth();
  const open = (mode) => () => router.push({ pathname: '/login', params: { mode } });

  return (
    <View style={styles.box}>
      <View style={styles.logo}>
        <Ionicons name="leaf" size={44} color={colors.white} />
      </View>
      <Text style={styles.brand}>HFarm</Text>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}

      {sessionExpired ? <Text style={styles.expired}>Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.</Text> : null}

      <View style={styles.actions}>
        <Button title="Đăng nhập" onPress={open('in')} />
        <Button title="Tạo tài khoản" variant="outline" onPress={open('up')} />
      </View>

      {onDismiss ? (
        <Pressable onPress={onDismiss} hitSlop={8} style={styles.dismiss}>
          <Text style={styles.dismissText}>{dismissLabel || 'Để sau'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.sm },
  logo: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 28, fontWeight: '800', color: colors.primaryDark, marginTop: space.sm },
  title: { fontSize: 18, fontWeight: '600', color: colors.text, textAlign: 'center', marginTop: space.xs },
  message: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20, maxWidth: 320 },
  expired: { fontSize: 13, color: colors.primaryDark, backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, textAlign: 'center', overflow: 'hidden' },
  actions: { alignSelf: 'stretch', gap: space.md, marginTop: space.lg, maxWidth: 360, width: '100%' },
  dismiss: { marginTop: space.md },
  dismissText: { fontSize: 14, color: colors.muted, textDecorationLine: 'underline' },
});
