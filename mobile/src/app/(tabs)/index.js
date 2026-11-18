import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { errMsg } from '@/api/client';
import { fetchCategories, fetchProducts } from '@/api/products';
import Chip from '@/components/Chip';
import EmptyState from '@/components/EmptyState';
import FilterSheet from '@/components/FilterSheet';
import KeyboardView from '@/components/KeyboardView';
import Loading from '@/components/Loading';
import ProductCard from '@/components/ProductCard';
import SearchOverlay from '@/components/SearchOverlay';
import { DEFAULT_SORT, EMPTY_FILTERS, activeFilterCount, clearFilters, sortShortLabel } from '@/utils/productFilters';
import { useSearchHistory } from '@/utils/searchHistory';
import { normalizeTerm } from '@/utils/searchTerms';
import { usePullRefresh } from '@/utils/useRefresh';
import { colors, radius, space } from '@/utils/theme';

const PAGE_SIZE = 12;
const GAP = space.md;

export default function Shop() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardWidth = (width - space.lg * 2 - GAP) / 2;

  // text: chữ đang gõ trong ô. q: từ khóa đang áp dụng lên danh sách (chỉ đổi khi bấm tìm / chọn gợi ý / lịch sử).
  // searching: đang ở ô tìm kiếm (hiện lớp gợi ý + lịch sử thay cho danh sách).
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  const history = useSearchHistory();
  const [categoryId, setCategoryId] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const filterCount = activeFilterCount(filters);

  const leaveSearch = () => {
    setSearching(false);
    inputRef.current?.blur();
    Keyboard.dismiss();
  };
  const commit = (term) => {
    const t = normalizeTerm(term);
    setText(t);
    setQ(t);
    if (t) history.add(t);
    leaveSearch();
  };
  const cancelSearch = () => {
    setText(q); // bỏ chữ gõ dở, quay về từ khóa đang áp dụng
    leaveSearch();
  };
  const clearText = () => {
    setText('');
    if (!searching) setQ(''); // đang xem kết quả: xóa ô = bỏ tìm kiếm
  };
  const openProduct = (product, typed) => {
    if (typed) history.add(typed);
    setText(q);
    leaveSearch();
    router.push(`/product/${product.id}`);
  };

  // Nút Back của Android: đang tìm kiếm thì thoát tìm kiếm thay vì thoát app
  useEffect(() => {
    if (!searching) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setText(q);
      setSearching(false);
      inputRef.current?.blur();
      return true;
    });
    return () => sub.remove();
  }, [searching, q]);

  const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: 5 * 60 * 1000 });

  const products = useInfiniteQuery({
    queryKey: ['products', { q, categoryId, filters }],
    queryFn: ({ pageParam }) => fetchProducts({ q, categoryId, filters, page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
  });
  // Sản phẩm mới thêm giữa lúc khách cuộn làm các trang lệch nhau: khử trùng theo id để không trùng key
  const items = useMemo(() => {
    const seen = new Map();
    for (const page of products.data?.pages ?? []) for (const p of page.data) if (!seen.has(p.id)) seen.set(p.id, p);
    return [...seen.values()];
  }, [products.data]);

  const { refreshing, onRefresh } = usePullRefresh(products.refetch);

  const loadMore = () => {
    if (products.hasNextPage && !products.isFetchingNextPage && !products.isFetchNextPageError) products.fetchNextPage();
  };

  let body;
  if (products.isPending) {
    body = <Loading />;
  } else if (products.isError && !items.length) {
    body = <EmptyState icon="cloud-offline-outline" title="Không tải được sản phẩm" message={errMsg(products.error)} actionLabel="Thử lại" onAction={() => products.refetch()} />;
  } else if (!items.length) {
    body = (
      <EmptyState
        icon="search-outline"
        title="Không tìm thấy sản phẩm"
        message={q || categoryId || filterCount ? 'Thử từ khóa, danh mục hoặc bộ lọc khác.' : 'Cửa hàng chưa có sản phẩm nào.'}
        actionLabel={filterCount ? 'Xóa bộ lọc' : undefined}
        onAction={() => setFilters(clearFilters(filters))}
      />
    );
  } else {
    body = (
      <FlatList
        data={items}
        keyExtractor={(p) => String(p.id)}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => <ProductCard product={item} width={cardWidth} onPress={() => router.push(`/product/${item.id}`)} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListFooterComponent={
          products.isFetchingNextPage ? (
            <ActivityIndicator style={styles.footer} color={colors.primary} />
          ) : products.isFetchNextPageError ? (
            <Pressable onPress={() => products.fetchNextPage()} style={styles.footer}>
              <Text style={styles.retry}>Không tải thêm được. Chạm để thử lại</Text>
            </Pressable>
          ) : null
        }
      />
    );
  }

  return (
    <KeyboardView style={styles.screen}>
      <View style={styles.searchRow}>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={text}
            onChangeText={setText}
            onFocus={() => setSearching(true)}
            onSubmitEditing={() => commit(text)}
            placeholder="Tìm sản phẩm..."
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            autoCorrect={false}
            aria-label="Tìm sản phẩm"
          />
          {text ? (
            <Pressable onPress={clearText} hitSlop={8} role="button" aria-label="Xóa chữ tìm kiếm">
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        {searching ? (
          <Pressable onPress={cancelSearch} hitSlop={8} role="button" aria-label="Hủy tìm kiếm">
            <Text style={styles.cancel}>Hủy</Text>
          </Pressable>
        ) : null}
      </View>

      {searching ? (
        <SearchOverlay
          text={text}
          committed={q}
          history={history.terms}
          onPickTerm={commit}
          onRemoveTerm={history.remove}
          onClearHistory={history.clear}
          onSubmit={() => commit(text)}
          onOpenProduct={openProduct}
        />
      ) : (
        <>
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
              <Chip label="Tất cả" selected={categoryId === null} onPress={() => setCategoryId(null)} />
              {(categories.data ?? []).map((c) => (
                <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
              ))}
            </ScrollView>
          </View>

          {categories.isError ? (
            <Pressable onPress={() => categories.refetch()} style={styles.catError}>
              <Text style={styles.retry}>Không tải được danh mục. Chạm để thử lại</Text>
            </Pressable>
          ) : null}

          <View style={styles.toolbar}>
            <Pressable
              style={[styles.filterBtn, filterCount > 0 && styles.filterBtnOn]}
              onPress={() => {
                Keyboard.dismiss();
                setSheetOpen(true);
              }}
              role="button"
              aria-label={filterCount ? `Lọc và sắp xếp, đang bật ${filterCount} bộ lọc` : 'Lọc và sắp xếp'}
            >
              <Ionicons name="options-outline" size={18} color={filterCount > 0 ? colors.primary : colors.text} />
              <Text style={[styles.filterText, filterCount > 0 && styles.filterTextOn]}>Lọc và sắp xếp</Text>
              {filterCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{filterCount}</Text>
                </View>
              ) : null}
            </Pressable>
            <Text style={styles.summary} numberOfLines={1}>
              {[
                q ? `“${q}”` : null,
                products.data ? `${products.data.pages[0].total} sản phẩm` : null,
                filters.sort !== DEFAULT_SORT ? sortShortLabel(filters.sort) : null,
              ].filter(Boolean).join(' · ')}
            </Text>
            {filterCount > 0 ? (
              <Pressable onPress={() => setFilters(clearFilters(filters))} hitSlop={8} role="button">
                <Text style={styles.clear}>Xóa lọc</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.body}>{body}</View>
        </>
      )}

      <FilterSheet
        visible={sheetOpen}
        value={filters}
        onClose={() => setSheetOpen(false)}
        onApply={(next) => {
          setFilters(next);
          setSheetOpen(false);
        }}
      />
    </KeyboardView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, margin: space.lg, marginBottom: space.sm },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: space.md,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0 },
  cancel: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  chips: { paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.sm },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.xs },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterBtnOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  filterText: { fontSize: 14, color: colors.text },
  filterTextOn: { color: colors.primary, fontWeight: '600' },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  summary: { flex: 1, fontSize: 13, color: colors.muted },
  clear: { fontSize: 14, color: colors.primary },
  body: { flex: 1 },
  list: { padding: space.lg, paddingTop: space.sm },
  row: { gap: GAP, marginBottom: GAP },
  footer: { paddingVertical: space.lg, alignItems: 'center' },
  catError: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  retry: { color: colors.primary, fontSize: 14 },
});
