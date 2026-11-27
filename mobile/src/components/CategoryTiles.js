import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Photo from './Photo';
import Skeleton from './Skeleton';
import { colors, space } from '@/utils/theme';

const SIZE = 76;
const ROUND = 22;

// Dải ô danh mục ở trang chủ: ô đầu "Tất cả", các ô sau lấy ảnh đại diện của danh mục (thumbnail từ GET /categories).
// Ô bo góc vuông (không tròn) và hiện trọn ảnh: ô tròn cắt mất 4 góc nên giày/túi chụp ngang bị khuất.
export default function CategoryTiles({ categories, loading, onPick }) {
  if (loading) {
    return (
      <View style={styles.list}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.tile}>
            <Skeleton style={{ width: SIZE, height: SIZE, borderRadius: ROUND }} />
            <Skeleton style={{ width: 44, height: 10 }} />
          </View>
        ))}
      </View>
    );
  }
  const data = [{ id: null, name: 'Tất cả' }, ...(categories ?? [])];
  return (
    <FlatList
      data={data}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(c) => String(c.id)}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <Pressable onPress={() => onPick(item.id)} style={styles.tile} role="link" aria-label={`Danh mục ${item.name}`}>
          {item.id === null ? (
            <View style={[styles.circle, styles.all]}>
              <Ionicons name="grid-outline" size={24} color={colors.primary} />
            </View>
          ) : item.thumbnail ? (
            <Photo uri={item.thumbnail} style={styles.circle} whole />
          ) : (
            <View style={[styles.circle, styles.all]}>
              <Text style={styles.initial}>{item.name.trim().charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.label} numberOfLines={2}>{item.name}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.lg, gap: space.lg },
  tile: { width: SIZE + 4, alignItems: 'center', gap: 6 },
  circle: { width: SIZE, height: SIZE, borderRadius: ROUND, overflow: 'hidden', borderWidth: 2, borderColor: colors.surface },
  all: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 22, fontWeight: '800', color: colors.primary },
  label: { fontSize: 12, color: colors.text, textAlign: 'center', fontWeight: '600', lineHeight: 15 },
});
