import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '@/utils/theme';

// variant: 'primary' (nền xanh đậm) | 'outline' (viền xanh) | 'soft' (nền xanh nhạt) | 'danger' (viền đỏ)
// icon: tên biểu tượng Ionicons đặt trước chữ
export default function Button({ title, onPress, variant = 'primary', loading = false, disabled = false, icon, style }) {
  const off = disabled || loading;
  const fg = variant === 'primary' ? colors.white : variant === 'danger' ? colors.danger : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      role="button"
      style={({ pressed }) => [styles.base, styles[variant], off && styles.off, pressed && styles.pressed, style]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={[styles.text, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  outline: { backgroundColor: colors.surface, borderColor: colors.primary },
  soft: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  danger: { backgroundColor: colors.surface, borderColor: colors.danger },
  off: { opacity: 0.45 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  text: { fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
});
