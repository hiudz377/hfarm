import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, space } from '@/utils/theme';

// Một hàng trong menu (Tài khoản): biểu tượng, tiêu đề, mô tả phụ, mũi tên
export default function MenuRow({ icon, title, subtitle, onPress, last = false }) {
  return (
    <Pressable onPress={onPress} role="button" style={({ pressed }) => [styles.row, !last && styles.border, pressed && styles.pressed]}>
      <View style={styles.icon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.sub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, minHeight: 56 },
  border: { borderBottomWidth: 1, borderBottomColor: colors.border },
  pressed: { backgroundColor: colors.primarySoft },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 1 },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  sub: { fontSize: 12, color: colors.muted },
});

