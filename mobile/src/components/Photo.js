import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { resolveImageUrl } from '@/utils/format';
import { colors } from '@/utils/theme';

// Ảnh từ backend: tự sửa URL localhost, có nền xám + biểu tượng khi thiếu ảnh
export default function Photo({ uri, style, contentFit = 'cover' }) {
  const src = resolveImageUrl(uri);
  if (!src) {
    return (
      <View style={[styles.box, styles.center, style]}>
        <Ionicons name="image-outline" size={32} color={colors.border} />
      </View>
    );
  }
  return <Image source={src} style={[styles.box, style]} contentFit={contentFit} transition={150} cachePolicy="memory-disk" />;
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#EDEBE4' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
