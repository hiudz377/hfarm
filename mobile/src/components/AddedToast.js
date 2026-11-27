import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Photo from './Photo';
import { colors, radius, shadow, space } from '@/utils/theme';

const SHOW_MS = 4500;

// Thanh báo "Đã thêm vào giỏ hàng" trượt lên từ dưới, thay cho hộp thoại Alert chặn màn hình.
// toast: { name, image } | null (đặt lại giá trị mới mỗi lần thêm). bottom: cách đáy bao nhiêu (để nằm trên thanh nút).
export default function AddedToast({ toast, bottom = 0, onView, onClose }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return undefined;
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
    const t = setTimeout(onClose, SHOW_MS);
    return () => clearTimeout(t);
  }, [toast]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!toast) return null;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}
    >
      <View style={styles.bar} role="alert">
        <Photo uri={toast.image} style={styles.photo} whole />
        <View style={styles.text}>
          <View style={styles.titleRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
            <Text style={styles.title}>Đã thêm vào giỏ hàng</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>{toast.name}</Text>
        </View>
        <Pressable onPress={onView} style={styles.view} role="button" aria-label="Xem giỏ hàng">
          <Text style={styles.viewText}>Xem giỏ</Text>
        </Pressable>
        <Pressable onPress={onClose} hitSlop={10} role="button" aria-label="Đóng thông báo">
          <Ionicons name="close" size={18} color={colors.muted} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg },
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, paddingRight: space.md,
    borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow.card, elevation: 8,
  },
  photo: { width: 44, height: 56, borderRadius: radius.sm },
  text: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { fontSize: 13, fontWeight: '800', color: colors.text },
  name: { fontSize: 12, color: colors.muted },
  view: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.primary },
  viewText: { color: colors.white, fontSize: 13, fontWeight: '800' },
});
