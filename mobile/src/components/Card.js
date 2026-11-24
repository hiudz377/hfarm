import { StyleSheet, View } from 'react-native';
import { colors, radius, shadow } from '@/utils/theme';

// clip = true: cắt nội dung theo góc bo (ví dụ ảnh sát mép). Lưu ý iOS không vẽ bóng khi cắt nội dung.
export default function Card({ children, style, clip = false }) {
  return <View style={[styles.card, clip && styles.clip, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.card,
  },
  clip: { overflow: 'hidden' },
});
