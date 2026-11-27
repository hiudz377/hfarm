import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { resolveImageUrl } from '@/utils/format';
import { colors } from '@/utils/theme';

// Ảnh từ backend: tự sửa URL localhost, có nền xám + biểu tượng khi thiếu ảnh.
// whole: hiện TRỌN ảnh, không cắt dù ảnh ngang/dọc/vuông (giày, túi... thường chụp ngang). Phần thừa quanh ảnh được lấp
// bằng chính ảnh đó phóng to và làm mờ, nên không có viền trắng/xám khó coi. Mặc định (cover) vẫn lấp đầy khung và cắt bớt: dùng cho banner, avatar.
export default function Photo({ uri, style, contentFit = 'cover', whole = false }) {
  const src = resolveImageUrl(uri);
  if (!src) {
    return (
      <View style={[styles.box, styles.center, style]}>
        <Ionicons name="image-outline" size={32} color={colors.border} />
      </View>
    );
  }
  if (whole) {
    return (
      <View style={[styles.box, style, styles.clip]}>
        <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={24} cachePolicy="memory-disk" accessible={false} />
        <Image source={src} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} cachePolicy="memory-disk" />
      </View>
    );
  }
  return <Image source={src} style={[styles.box, style]} contentFit={contentFit} transition={150} cachePolicy="memory-disk" />;
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#EDEBE4' },
  clip: { overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
