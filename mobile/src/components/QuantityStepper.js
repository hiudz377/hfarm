import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '@/utils/theme';

export default function QuantityStepper({ value, onChange, min = 1, max = 99, disabled = false }) {
  const dec = disabled || value <= min;
  const inc = disabled || value >= max;
  return (
    <View style={[styles.row, disabled && styles.off]}>
      <Pressable style={[styles.btn, dec && styles.off]} disabled={dec} onPress={() => onChange(value - 1)} hitSlop={6}
        role="button" aria-label="Giảm số lượng">
        <Ionicons name="remove" size={20} color={colors.text} />
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable style={[styles.btn, inc && styles.off]} disabled={inc} onPress={() => onChange(value + 1)} hitSlop={6}
        role="button" aria-label="Tăng số lượng">
        <Ionicons name="add" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  btn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { minWidth: 34, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.text },
  off: { opacity: 0.4 },
});
