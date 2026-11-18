import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { fetchPopular, fetchSuggestions } from '@/api/products';
import Photo from '@/components/Photo';
import { money } from '@/utils/format';
import { normalizeTerm, splitMatch } from '@/utils/searchTerms';
import { useDebounce } from '@/utils/useDebounce';
import { colors, space } from '@/utils/theme';

// Tên sản phẩm với phần khớp chữ đang gõ được tô đậm
function Highlighted({ name, query }) {
  const { before, match, after } = splitMatch(name, query);
  return (
    <Text style={styles.name} numberOfLines={2}>
      {before}
      {match ? <Text style={styles.match}>{match}</Text> : null}
      {after}
    </Text>
  );
}

// Lớp hiện khi người dùng đang ở ô tìm kiếm.
// - Chưa gõ gì mới (ô trống, hoặc vẫn đúng từ khóa đang áp dụng `committed`): "Tìm kiếm gần đây" (xóa từng mục / xóa tất cả) + "Phổ biến".
// - Đang gõ: dòng "Tìm “...”" + gợi ý sản phẩm khớp tên (không phân biệt hoa/thường và dấu).
export default function SearchOverlay({ text, committed, history, onPickTerm, onRemoveTerm, onClearHistory, onSubmit, onOpenProduct }) {
  const q = normalizeTerm(text);
  const debounced = useDebounce(q, 250);
  const typing = q.length > 0 && q !== normalizeTerm(committed);

  const suggestions = useQuery({
    queryKey: ['suggest', debounced.toLowerCase()],
    queryFn: () => fetchSuggestions(debounced),
    enabled: typing && debounced.length > 0,
    staleTime: 60 * 1000,
  });
  const popular = useQuery({ queryKey: ['popular'], queryFn: fetchPopular, staleTime: 5 * 60 * 1000, enabled: !typing });

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      {typing ? (
        <View>
          <Pressable onPress={onSubmit} style={styles.row} role="button" aria-label={`Tìm ${q}`}>
            <Ionicons name="search" size={18} color={colors.primary} />
            <Text style={styles.searchText} numberOfLines={1}>Tìm “{q}”</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.muted} />
          </Pressable>
          {debounced !== q || suggestions.isFetching ? (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          ) : suggestions.isError ? (
            <Text style={styles.note}>Không tải được gợi ý. Bạn vẫn có thể bấm tìm kiếm.</Text>
          ) : (suggestions.data ?? []).length === 0 ? (
            <Text style={styles.note}>Không có sản phẩm nào khớp “{q}”.</Text>
          ) : (
            (suggestions.data ?? []).map((p) => (
              <Pressable key={p.id} onPress={() => onOpenProduct(p, q)} style={styles.row} role="button" aria-label={`Mở ${p.name}`}>
                <Photo uri={p.thumbnail} style={styles.thumb} />
                <View style={styles.grow}>
                  <Highlighted name={p.name} query={q} />
                  <Text style={styles.price}>{money(p.price)}</Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      ) : (
        <View style={styles.sections}>
          {history.length ? (
            <View>
              <View style={styles.head}>
                <Text style={styles.title}>Tìm kiếm gần đây</Text>
                <Pressable onPress={onClearHistory} hitSlop={8} role="button">
                  <Text style={styles.link}>Xóa tất cả</Text>
                </Pressable>
              </View>
              {history.map((t) => (
                <View key={t} style={styles.row}>
                  <Pressable style={styles.historyMain} onPress={() => onPickTerm(t)} role="button" aria-label={`Tìm lại ${t}`}>
                    <Ionicons name="time-outline" size={18} color={colors.muted} />
                    <Text style={styles.historyText} numberOfLines={1}>{t}</Text>
                  </Pressable>
                  <Pressable onPress={() => onRemoveTerm(t)} hitSlop={10} role="button" aria-label={`Xóa ${t} khỏi lịch sử`}>
                    <Ionicons name="close" size={18} color={colors.muted} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {(popular.data ?? []).length ? (
            <View>
              <Text style={styles.title}>Phổ biến</Text>
              <View style={styles.chips}>
                {(popular.data ?? []).map((p) => (
                  <Pressable key={p.id} onPress={() => onPickTerm(p.name)} style={styles.chip} role="button" aria-label={`Tìm ${p.name}`}>
                    <Ionicons name="trending-up" size={14} color={colors.primary} />
                    <Text style={styles.chipText} numberOfLines={1}>{p.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {!history.length && !(popular.data ?? []).length && !popular.isPending ? (
            <Text style={styles.note}>Nhập tên sản phẩm để tìm kiếm.</Text>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.surface },
  content: { paddingBottom: space.xl },
  sections: { padding: space.lg, gap: space.xl },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: space.xs },
  link: { fontSize: 13, color: colors.primary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchText: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '600' },
  thumb: { width: 44, height: 56, borderRadius: 6 },
  grow: { flex: 1, gap: 2 },
  name: { fontSize: 14, color: colors.text, lineHeight: 19 },
  match: { fontWeight: '800', color: colors.primaryDark },
  price: { fontSize: 13, fontWeight: '700', color: colors.primary },
  loading: { paddingVertical: space.lg },
  note: { padding: space.lg, fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  historyMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  historyText: { flex: 1, fontSize: 15, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  chipText: { fontSize: 13, color: colors.primaryDark, flexShrink: 1 },
});
