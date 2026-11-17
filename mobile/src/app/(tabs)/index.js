import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { errMsg } from '@/api/client';
import { fetchCategories, fetchProducts } from '@/api/products';
import Chip from '@/components/Chip';
import EmptyState from '@/components/EmptyState';
import KeyboardView from '@/components/KeyboardView';
import Loading from '@/components/Loading';
import ProductCard from '@/components/ProductCard';
import { useDebounce } from '@/utils/useDebounce';
import { usePullRefresh } from '@/utils/useRefresh';
import { colors, radius, space } from '@/utils/theme';

const PAGE_SIZE = 12;
const GAP = space.md;

export default function Shop() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardWidth = (width - space.lg * 2 - GAP) / 2;

  const [text, setText] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const q = useDebounce(text.trim(), 400);

  const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: 5 * 60 * 1000 });

  const products = useInfiniteQuery({
    queryKey: ['products', { q, categoryId }],
    queryFn: ({ pageParam }) => fetchProducts({ q, categoryId, page: pageParam, limit: PAGE_SIZE }),
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
    body = <EmptyState icon="search-outline" title="Không tìm thấy sản phẩm" message={q || categoryId ? 'Thử từ khóa hoặc danh mục khác.' : 'Cửa hàng chưa có sản phẩm nào.'} />;
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
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Tìm sản phẩm..."
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          autoCorrect={false}
        />
        {text ? (
          <Pressable onPress={() => setText('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

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

      <View style={styles.body}>{body}</View>
    </KeyboardView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: space.lg,
    marginBottom: space.sm,
    paddingHorizontal: space.md,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0 },
  chips: { paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.sm },
  body: { flex: 1 },
  list: { padding: space.lg, paddingTop: space.sm },
  row: { gap: GAP, marginBottom: GAP },
  footer: { paddingVertical: space.lg, alignItems: 'center' },
  catError: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  retry: { color: colors.primary, fontSize: 14 },
});
