import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/auth/AuthProvider';
import { authErrorMessage } from '@/auth/keycloak';
import Button from '@/components/Button';
import { useMounted } from '@/utils/useMounted';
import { colors, radius, space } from '@/utils/theme';

// Khối "Đăng nhập / Tạo tài khoản" mang thương hiệu HFarm. Dùng ở màn /login và thay cho nội dung các tab
// cần đăng nhập (Giỏ hàng, Đơn hàng, Tài khoản) khi khách chưa đăng nhập.
// Bấm nút sẽ mở trang Keycloak trong trình duyệt hệ thống (đăng nhập / đăng ký đều do Keycloak xử lý).
export default function LoginPanel({ title = 'Chào mừng đến với HFarm', message, dismissLabel, onDismiss }) {
  const { signIn, signUp, sessionExpired } = useAuth();
  const mounted = useMounted();
  const [busy, setBusy] = useState(null); // 'in' | 'up' | null
  const [error, setError] = useState(null);

  const run = (kind, action) => async () => {
    if (busy) return;
    setBusy(kind);
    setError(null);
    try {
      await action(); // 'cancelled' (đóng trình duyệt) không phải lỗi, không cần báo
    } catch (e) {
      if (mounted.current) setError(authErrorMessage(e));
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  return (
    <View style={styles.box}>
      <View style={styles.logo}>
        <Ionicons name="leaf" size={44} color={colors.white} />
      </View>
      <Text style={styles.brand}>HFarm</Text>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}

      {sessionExpired ? <Text style={styles.expired}>Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Button title="Đăng nhập" loading={busy === 'in'} disabled={!!busy} onPress={run('in', signIn)} />
        <Button title="Tạo tài khoản" variant="outline" loading={busy === 'up'} disabled={!!busy} onPress={run('up', signUp)} />
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
  error: { fontSize: 13, color: colors.danger, textAlign: 'center', lineHeight: 18, maxWidth: 320 },
  actions: { alignSelf: 'stretch', gap: space.md, marginTop: space.lg, maxWidth: 360, width: '100%' },
  dismiss: { marginTop: space.md },
  dismissText: { fontSize: 14, color: colors.muted, textDecorationLine: 'underline' },
});
