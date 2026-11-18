import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFavorites } from '@/utils/useFavorites';
import { colors } from '@/utils/theme';

// Nút trái tim tròn nổi trên ảnh sản phẩm. Chưa đăng nhập thì mời đăng nhập (xử lý trong useFavorites).
export default function FavoriteButton({ productId, size = 18, style }) {
  const { isFav, toggle } = useFavorites();
  const on = isFav(productId);
  return (
    <Pressable
      onPress={() => toggle(productId)}
      hitSlop={8}
      role="button"
      aria-label={on ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
      aria-pressed={on}
      style={[styles.btn, style]}
    >
      <Ionicons name={on ? 'heart' : 'heart-outline'} size={size} color={on ? colors.danger : colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
});
