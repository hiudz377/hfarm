import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/utils/theme';

// Dùng cho lọc danh mục, chọn màu, chọn size.
// dimmed: tùy chọn hết hàng (làm mờ nhưng vẫn bấm được). swatch: mã màu hex hiển thị chấm màu.
export default function Chip({ label, selected = false, dimmed = false, swatch, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.selected, dimmed && styles.dimmed]}
    >
      {swatch ? <View style={[styles.dot, { backgroundColor: swatch }]} /> : null}
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dimmed: { opacity: 0.4 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.border },
  text: { fontSize: 14, color: colors.text },
  textSelected: { color: colors.white, fontWeight: '600' },
});
