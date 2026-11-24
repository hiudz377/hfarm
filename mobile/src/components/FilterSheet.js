import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchBrands, fetchColors, fetchSizes } from '@/api/products';
import Button from '@/components/Button';
import Chip from '@/components/Chip';
import { EMPTY_FILTERS, PRICE_RANGES, SORT_OPTIONS, toggleId } from '@/utils/productFilters';
import { colors, radius, space } from '@/utils/theme';

const STALE = 5 * 60 * 1000;

const SIZE_GROUPS = [
  { key: 'LETTER', label: 'Size chữ' },
  { key: 'NUMBER', label: 'Size số' },
  { key: 'OTHER', label: 'Khác' },
];

// Size chữ (S, M, XL...) và size số (28, 40...) tách thành hai cụm; chỉ hiện tiêu đề cụm khi có từ hai cụm trở lên
function SizeChips({ list, selected, onToggle }) {
  const groups = SIZE_GROUPS.map((g) => ({ ...g, items: list.filter((s) => s.size_group === g.key) })).filter((g) => g.items.length);
  return groups.map((g) => (
    <View key={g.key} style={styles.sizeGroup}>
      {groups.length > 1 ? <Text style={styles.subTitle}>{g.label}</Text> : null}
      <View style={styles.wrap}>
        {g.items.map((s) => (
          <Chip key={s.id} label={s.name} selected={selected.includes(s.id)} onPress={() => onToggle(s.id)} />
        ))}
      </View>
    </View>
  ));
}

// Một nhóm tùy chọn lấy từ API (size / màu / thương hiệu): tự xử lý đang tải, lỗi + thử lại, danh sách trống.
// column: các phần tử con tự xếp hàng riêng (dùng cho size chia cụm)
function Group({ title, query, column = false, children }) {
  if (!query.isPending && !query.isError && !query.data?.length) return null;
  let body;
  if (query.isPending) {
    body = <ActivityIndicator color={colors.primary} style={styles.loading} />;
  } else if (query.isError) {
    body = (
      <Pressable onPress={() => query.refetch()} role="button">
        <Text style={styles.retry}>Không tải được. Chạm để thử lại</Text>
      </Pressable>
    );
  } else {
    body = <View style={column ? styles.column : styles.wrap}>{children(query.data)}</View>;
  }
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {body}
    </View>
  );
}

// Bảng lọc + sắp xếp trượt từ dưới lên. Người dùng chỉnh trên bản nháp; chỉ khi bấm "Áp dụng" mới đổi danh sách.
// value / onApply(filters): state theo src/utils/productFilters.js
export default function FilterSheet({ visible, value, onApply, onClose }) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (visible) setDraft(value); // mở lại thì bắt đầu từ bộ lọc đang áp dụng, bỏ phần chỉnh dở lần trước
  }, [visible, value]);

  const sizes = useQuery({ queryKey: ['sizes'], queryFn: fetchSizes, staleTime: STALE, enabled: visible });
  const colorList = useQuery({ queryKey: ['colors'], queryFn: fetchColors, staleTime: STALE, enabled: visible });
  const brands = useQuery({ queryKey: ['brands'], queryFn: fetchBrands, staleTime: STALE, enabled: visible });

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} role="button" aria-label="Đóng bộ lọc" />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Lọc và sắp xếp</Text>
            <Pressable onPress={onClose} hitSlop={10} role="button" aria-label="Đóng">
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            <View style={styles.group}>
              <Text style={styles.groupTitle}>Sắp xếp</Text>
              <View style={styles.wrap}>
                {SORT_OPTIONS.map((o) => (
                  <Chip key={o.key} label={o.label} selected={draft.sort === o.key} onPress={() => set({ sort: o.key })} />
                ))}
              </View>
            </View>

            <View style={styles.group}>
              <Text style={styles.groupTitle}>Khoảng giá</Text>
              <View style={styles.wrap}>
                {PRICE_RANGES.map((r) => (
                  <Chip
                    key={r.key}
                    label={r.label}
                    selected={draft.priceKey === r.key}
                    onPress={() => set({ priceKey: draft.priceKey === r.key ? null : r.key })}
                  />
                ))}
              </View>
            </View>

            <Group title="Size" query={sizes} column>
              {(list) => (
                <SizeChips list={list} selected={draft.sizeIds} onToggle={(id) => set({ sizeIds: toggleId(draft.sizeIds, id) })} />
              )}
            </Group>

            <Group title="Màu sắc" query={colorList}>
              {(list) => list.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  swatch={c.hex_code || undefined}
                  selected={draft.colorIds.includes(c.id)}
                  onPress={() => set({ colorIds: toggleId(draft.colorIds, c.id) })}
                />
              ))}
            </Group>

            <Group title="Thương hiệu" query={brands}>
              {(list) => list.map((b) => (
                <Chip key={b.id} label={b.name} selected={draft.brandIds.includes(b.id)} onPress={() => set({ brandIds: toggleId(draft.brandIds, b.id) })} />
              ))}
            </Group>

            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={styles.groupTitle}>Chỉ hiện sản phẩm còn hàng</Text>
                <Text style={styles.hint}>Khi chọn size hoặc màu, tính theo đúng loại đó.</Text>
              </View>
              <Switch
                value={draft.inStock}
                onValueChange={(inStock) => set({ inStock })}
                trackColor={{ true: colors.primary }}
                aria-label="Chỉ hiện sản phẩm còn hàng"
              />
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={styles.groupTitle}>Chỉ hiện sản phẩm đang giảm giá</Text>
              </View>
              <Switch
                value={draft.onSale}
                onValueChange={(onSale) => set({ onSale })}
                trackColor={{ true: colors.primary }}
                aria-label="Chỉ hiện sản phẩm đang giảm giá"
              />
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
            <Button title="Đặt lại" variant="outline" onPress={() => setDraft(EMPTY_FILTERS)} style={styles.footerBtn} />
            <Button title="Áp dụng" onPress={() => onApply(draft)} style={styles.footerBtn} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  scroll: { flexShrink: 1 },
  content: { padding: space.lg, gap: space.lg },
  group: { gap: space.sm },
  groupTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  column: { gap: space.md },
  sizeGroup: { gap: space.xs },
  subTitle: { fontSize: 12, color: colors.muted },
  loading: { alignSelf: 'flex-start' },
  retry: { color: colors.primary, fontSize: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  switchText: { flex: 1, gap: 2 },
  hint: { fontSize: 12, color: colors.muted },
  footer: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerBtn: { flex: 1 },
});
