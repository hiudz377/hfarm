import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius } from '@/utils/theme';

// variant: 'primary' (nền xanh) | 'outline' (viền xanh) | 'danger' (viền đỏ)
export default function Button({ title, onPress, variant = 'primary', loading = false, disabled = false, style }) {
  const off = disabled || loading;
  const fg = variant === 'primary' ? colors.white : variant === 'danger' ? colors.danger : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [styles.base, styles[variant], off && styles.off, pressed && styles.pressed, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.text, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  outline: { backgroundColor: colors.surface, borderColor: colors.primary },
  danger: { backgroundColor: colors.surface, borderColor: colors.danger },
  off: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  text: { fontSize: 15, fontWeight: '600' },
});
