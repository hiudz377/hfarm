import { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchBanners, fetchCategories } from '@/api/products';
import { fetchPaymentMethods } from '@/api/payments';
import { fetchShippingEstimate } from '@/api/shipping';
import BrandLogo from '@/components/BrandLogo';
import Button from '@/components/Button';
import CategoryTiles from '@/components/CategoryTiles';
import HeroCarousel from '@/components/HeroCarousel';
import ProductRail from '@/components/ProductRail';
import { etaText, money } from '@/utils/format';
import { usePullRefresh } from '@/utils/useRefresh';
import { colors, radius, space } from '@/utils/theme';

function Perk({ icon, title, sub }) {
  return (
    <View style={styles.perk}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.perkTitle} numberOfLines={2}>{title}</Text>
      {sub ? <Text style={styles.perkSub} numberOfLines={2}>{sub}</Text> : null}
    </View>
  );
}

// Trang chủ: banner, ưu đãi giao hàng/thanh toán (lấy từ cấu hình thật của cửa hàng), danh mục, các dải sản phẩm
export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const banners = useQuery({ queryKey: ['banners'], queryFn: fetchBanners, staleTime: 60 * 1000 });
  const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: 5 * 60 * 1000 });
  const estimate = useQuery({ queryKey: ['shipping-estimate', 'default'], queryFn: () => fetchShippingEstimate(), staleTime: 5 * 60 * 1000 });
  const methods = useQuery({ queryKey: ['payment-methods'], queryFn: fetchPaymentMethods, staleTime: 5 * 60 * 1000 });

  const { refreshing, onRefresh } = usePullRefresh(
    useCallback(
      () => Promise.all([
        queryClient.refetchQueries({ queryKey: ['home'] }),
        banners.refetch(), categories.refetch(), estimate.refetch(), methods.refetch(),
      ]),
      [queryClient, banners, categories, estimate, methods],
    ),
  );

  // Tab Cửa hàng giữ trạng thái khi chuyển tab, nên kèm mốc thời gian để mọi lần bấm đều được áp dụng lại
  const goShop = (params = {}) => router.navigate({ pathname: '/shop', params: { ...params, t: String(Date.now()) } });
  const openBanner = (b) => {
    if (b.link_type === 'PRODUCT') router.push(`/product/${b.link_value}`);
    else if (b.link_type === 'CATEGORY') goShop({ category: b.link_value });
    else if (b.link_type === 'COLLECTION') goShop({ collection: b.link_value });
  };

  const z = estimate.data;
  const hasBank = (methods.data?.methods ?? []).some((m) => m.value === 'BANK_TRANSFER');
  const eta = etaText(z);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
    >
      <View style={styles.top}>
        <BrandLogo variant="mark" width={54} />
        <View style={styles.brandText}>
          <BrandLogo variant="wordmark" width={100} />
          <Text style={styles.brandSub}>Thời trang</Text>
        </View>
      </View>

      <Pressable onPress={() => goShop({ focus: '1' })} style={styles.search} role="button" aria-label="Tìm sản phẩm">
        <Ionicons name="search" size={18} color={colors.muted} />
        <Text style={styles.searchText}>Tìm áo, quần, váy...</Text>
      </Pressable>

      <HeroCarousel banners={banners.data} onOpen={openBanner} onShop={() => goShop()} />

      {z || methods.data ? (
        <View style={styles.perks}>
          {z ? (
            <Perk
              icon="bicycle-outline"
              title={z.free_over != null ? `Miễn phí ship từ ${money(z.free_over)}` : `Phí ship ${money(z.fee)}`}
              sub={z.free_over != null ? `Dưới mức này: ${money(z.base_fee)}` : null}
            />
          ) : null}
          {eta ? <Perk icon="time-outline" title={`Giao trong ${eta}`} sub="Tùy khu vực nhận hàng" /> : null}
          {methods.data ? (
            <Perk icon={hasBank ? 'qr-code-outline' : 'cash-outline'} title={hasBank ? 'Thanh toán QR hoặc COD' : 'Thanh toán khi nhận hàng'} sub={hasBank ? 'Quét mã bằng app ngân hàng' : null} />
          ) : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, styles.pad]}>Danh mục</Text>
        <CategoryTiles
          categories={categories.data}
          loading={categories.isPending}
          onPick={(id) => goShop(id ? { category: String(id) } : {})}
        />
        {categories.isError ? (
          <Pressable onPress={() => categories.refetch()} style={styles.pad}>
            <Text style={styles.retry}>Không tải được danh mục. Chạm để thử lại</Text>
          </Pressable>
        ) : null}
      </View>

      <ProductRail title="Hàng mới về" kind="new" onSeeAll={() => goShop()} />
      <ProductRail title="Bán chạy" kind="bestseller" onSeeAll={() => goShop({ collection: 'bestseller' })} />
      <ProductRail title="Đang giảm giá" kind="sale" onSeeAll={() => goShop({ collection: 'sale' })} />

      <View style={styles.pad}>
        <Button title="Xem toàn bộ cửa hàng" variant="outline" icon="storefront-outline" onPress={() => goShop()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { gap: space.xl, paddingBottom: space.xxl },
  pad: { paddingHorizontal: space.lg },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.lg },
  brandText: { gap: 2 },
  brandSub: { fontSize: 10, fontWeight: '700', color: colors.primary, letterSpacing: 3.2, textTransform: 'uppercase', paddingLeft: 4 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, marginHorizontal: space.lg, marginTop: -space.sm,
    paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  searchText: { fontSize: 15, color: colors.muted },
  perks: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg },
  perk: {
    flex: 1, gap: 4, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  perkTitle: { fontSize: 12, fontWeight: '800', color: colors.text, lineHeight: 16 },
  perkSub: { fontSize: 11, color: colors.muted, lineHeight: 14 },
  section: { gap: space.md },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  retry: { color: colors.primary, fontSize: 14 },
});
