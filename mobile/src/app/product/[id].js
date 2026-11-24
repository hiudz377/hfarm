import { useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errMsg } from '@/api/client';
import { addToCart } from '@/api/cart';
import { useAuth } from '@/auth/AuthProvider';
import { fetchProduct } from '@/api/products';
import { fetchShippingEstimate } from '@/api/shipping';
import AddedToast from '@/components/AddedToast';
import Button from '@/components/Button';
import Chip from '@/components/Chip';
import EmptyState from '@/components/EmptyState';
import FavoriteButton from '@/components/FavoriteButton';
import Loading from '@/components/Loading';
import Photo from '@/components/Photo';
import QuantityStepper from '@/components/QuantityStepper';
import RelatedProducts from '@/components/RelatedProducts';
import ReviewSection from '@/components/ReviewSection';
import Stars from '@/components/Stars';
import { etaText, money } from '@/utils/format';
import { goBack, goToTab } from '@/utils/nav';
import { CART_KEY, useCart } from '@/utils/useCart';
import { colors, radius, space } from '@/utils/theme';

// Lấy các giá trị duy nhất theo `key`, giữ thứ tự (backend đã sắp theo size.sort_order, color.id)
const uniq = (list, key, map) => {
  const seen = new Set();
  const out = [];
  for (const v of list) {
    if (!seen.has(v[key])) {
      seen.add(v[key]);
      out.push(map(v));
    }
  }
  return out;
};

const InfoRow = ({ label, value, last }) => (
  <View style={[styles.infoRow, !last && styles.infoBorder]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

export default function ProductDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const { status } = useAuth();

  const { data: product, isPending, isError, error, refetch } = useQuery({
    queryKey: ['product', String(id)],
    queryFn: () => fetchProduct(id),
  });

  const [pickedColor, setPickedColor] = useState(null);
  const [pickedSize, setPickedSize] = useState(null);
  const [qty, setQty] = useState(1);
  const [page, setPage] = useState(0);
  const [descOpen, setDescOpen] = useState(false);
  const [toast, setToast] = useState(null); // { name, image } khi vừa thêm vào giỏ
  const gallery = useRef(null);

  // Thông tin giao hàng (vùng mặc định của cửa hàng): phí, miễn phí từ bao nhiêu, thời gian giao
  const ship = useQuery({ queryKey: ['shipping-estimate', 'default'], queryFn: () => fetchShippingEstimate(), staleTime: 5 * 60 * 1000 });

  // Giỏ hiện tại (cùng cache với tab Giỏ hàng): để biết trong giỏ đã có bao nhiêu của biến thể này
  const { data: cart } = useCart();

  // Chống chạm đúp: backend CỘNG DỒN số lượng và không giới hạn theo tồn kho, nên hai lần chạm sát nhau sẽ thêm gấp đôi.
  // Ref khóa ngay trong cùng nhịp bấm (trạng thái loading của nút cập nhật chậm hơn một nhịp).
  const adding = useRef(false);
  const add = useMutation({
    mutationFn: addToCart,
    onSuccess: (newCart) => {
      // Backend trả về cả giỏ mới: ghi thẳng vào cache để badge + tab Giỏ hàng cập nhật ngay, không chờ tải lại
      queryClient.setQueryData(CART_KEY, newCart);
      setQty(1);
      // Thanh báo trượt lên (không chặn màn hình); "Xem giỏ" -> dismissTo: quay về màn (tabs) đã có rồi chọn tab Giỏ hàng.
      // navigate('/cart') sẽ chồng thêm một bản (tabs) mới.
      setToast({ name: product.name, image: product.images?.[0]?.image_url ?? null, at: Date.now() });
    },
    onError: (e) => {
      Alert.alert('Không thêm được vào giỏ', errMsg(e));
      queryClient.invalidateQueries({ queryKey: CART_KEY }); // lỗi thì không chắc giỏ đang ra sao: tải lại
    },
    onSettled: () => {
      adding.current = false;
    },
  });

  const variants = useMemo(() => product?.variants ?? [], [product]);
  const colorOptions = useMemo(() => uniq(variants, 'color_id', (v) => ({ id: v.color_id, name: v.color_name, hex: v.hex_code })), [variants]);
  const sizeOptions = useMemo(() => uniq(variants, 'size_id', (v) => ({ id: v.size_id, name: v.size_name })), [variants]);

  if (isPending) return <Loading />;
  // Chỉ thay cả màn bằng báo lỗi khi KHÔNG có dữ liệu cache (refetch nền lỗi thì vẫn cho xem bản đã có)
  if (isError && !product) {
    // 404: sản phẩm đã bị ẩn / xóa (ví dụ mở từ giỏ hàng): "Thử lại" vô nghĩa nên chỉ cho quay lại
    if (error?.response?.status === 404) {
      return <EmptyState icon="shirt-outline" title="Sản phẩm không còn bán" message="Sản phẩm này đã bị ẩn hoặc xóa." actionLabel="Quay lại" onAction={() => goBack(router, '/')} />;
    }
    return <EmptyState icon="cloud-offline-outline" title="Không tải được sản phẩm" message={errMsg(error)} actionLabel="Thử lại" onAction={() => refetch()} />;
  }

  // Chỉ có 1 màu / 1 size thì chọn sẵn
  const colorId = pickedColor ?? (colorOptions.length === 1 ? colorOptions[0].id : null);
  const sizeId = pickedSize ?? (sizeOptions.length === 1 ? sizeOptions[0].id : null);
  const variant = variants.find((v) => v.color_id === colorId && v.size_id === sizeId) ?? null;
  const stock = variant ? Number(variant.stock) : 0;
  // Backend cộng dồn vào giỏ và không giới hạn theo tồn kho, nên app tự chặn: còn thêm được = tồn - đã có trong giỏ
  const inCart = variant ? (cart?.items.find((i) => i.variant_id === variant.id)?.quantity ?? 0) : 0;
  const room = Math.max(stock - inCart, 0);
  const quantity = Math.min(qty, Math.max(room, 1));

  // Còn hàng nếu có biến thể khớp (màu/size đang chọn, null = bất kỳ) với tồn kho > 0
  const inStock = (c, s) => variants.some((v) => (c == null || v.color_id === c) && (s == null || v.size_id === s) && Number(v.stock) > 0);

  const prices = variants.map((v) => v.price);
  const priceText = variant
    ? money(variant.price)
    : prices.length && Math.min(...prices) !== Math.max(...prices)
      ? `${money(Math.min(...prices))} - ${money(Math.max(...prices))}`
      : money(prices.length ? prices[0] : product.base_price);
  // Giá gạch ngang + nhãn giảm giá chỉ hiện khi biết rõ đang nói về phiên bản nào: đã chọn phiên bản, hoặc mọi phiên bản cùng một giá.
  // (Chưa chọn mà giá là một khoảng thì không hiện, tránh nhãn giảm giá đi kèm khoảng giá gây hiểu nhầm.)
  const uniformPrice = prices.length > 0 && Math.min(...prices) === Math.max(...prices);
  const refVariant = variant ?? (uniformPrice ? variants[0] : null);
  const comparePrice = refVariant && refVariant.compare_at_price > refVariant.price ? refVariant.compare_at_price : null;
  const discount = comparePrice ? Math.round((1 - refVariant.price / comparePrice) * 100) : 0;
  const onShare = async () => {
    try {
      await Share.share({ message: `${product.name} - ${priceText}` });
    } catch {
      // người dùng đóng hộp chia sẻ hoặc thiết bị không hỗ trợ: bỏ qua
    }
  };

  let cta = 'Thêm vào giỏ';
  if (!variants.length) cta = 'Chưa mở bán';
  else if (colorId == null && sizeId == null) cta = 'Chọn màu và size';
  else if (colorId == null) cta = 'Chọn màu';
  else if (sizeId == null) cta = 'Chọn size';
  else if (!variant) cta = 'Không có phiên bản này';
  else if (stock <= 0) cta = 'Hết hàng';
  else if (room <= 0) cta = 'Đã có tối đa trong giỏ';
  const canAdd = !!variant && room > 0;

  const pics = product.images.length ? product.images.map((i) => i.image_url) : [null];
  const imgHeight = width * 1.1;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View>
          <FlatList
            ref={gallery}
            data={pics}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            renderItem={({ item }) => <Photo uri={item} style={{ width, height: imgHeight }} />}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          />
          <View style={styles.actions}>
            <Pressable onPress={onShare} hitSlop={8} role="button" aria-label="Chia sẻ sản phẩm" style={styles.circle}>
              <Ionicons name="share-social-outline" size={19} color={colors.text} />
            </Pressable>
            <FavoriteButton productId={product.id} size={20} />
          </View>
          {discount > 0 ? (
            <View style={styles.discount}>
              <Text style={styles.discountText}>-{discount}%</Text>
            </View>
          ) : null}
          {pics.length > 1 ? (
            <View style={styles.dots}>
              {pics.map((_, i) => <View key={i} style={[styles.dot, i === page && styles.dotOn]} />)}
            </View>
          ) : null}
        </View>

        {pics.length > 1 ? (
          <FlatList
            data={pics}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={styles.thumbs}
            renderItem={({ item, index }) => (
              <Pressable
                onPress={() => {
                  gallery.current?.scrollToIndex({ index, animated: true });
                  setPage(index);
                }}
                role="button"
                aria-label={`Xem ảnh ${index + 1}`}
                style={[styles.thumbWrap, index === page && styles.thumbOn]}
              >
                <Photo uri={item} style={styles.thumb} />
              </Pressable>
            )}
          />
        ) : null}

        <View style={styles.section}>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.meta}>{[product.brand_name, product.category_name].filter(Boolean).join(' · ')}</Text>
          <View style={styles.ratingRow}>
            {Number(product.rating_count) > 0 ? (
              <>
                <Stars value={Number(product.rating_avg)} size={15} />
                <Text style={styles.ratingText}>{Number(product.rating_avg).toFixed(1)} ({product.rating_count} đánh giá)</Text>
              </>
            ) : (
              <Text style={styles.ratingText}>Chưa có đánh giá</Text>
            )}
            {Number(product.sold_count) > 0 ? <Text style={styles.ratingText}>· Đã bán {product.sold_count}</Text> : null}
          </View>
          <View style={styles.priceRow}>
            <Text style={[styles.price, comparePrice && styles.priceSale]}>{priceText}</Text>
            {comparePrice ? <Text style={styles.compare}>{money(comparePrice)}</Text> : null}
            {discount > 0 ? <Text style={styles.saveTag}>Tiết kiệm {money(comparePrice - refVariant.price)}</Text> : null}
          </View>
        </View>

        {ship.data ? (
          <View style={styles.section}>
            <View style={styles.delivery}>
              <View style={styles.deliveryRow}>
                <Ionicons name="bicycle-outline" size={20} color={colors.primary} />
                <Text style={styles.deliveryText}>
                  {ship.data.free_over != null ? `Miễn phí vận chuyển cho đơn từ ${money(ship.data.free_over)}` : `Phí vận chuyển ${money(ship.data.fee)}`}
                </Text>
              </View>
              {ship.data.eta_max_days != null ? (
                <View style={styles.deliveryRow}>
                  <Ionicons name="time-outline" size={20} color={colors.primary} />
                  <Text style={styles.deliveryText}>
                    Dự kiến giao trong {etaText(ship.data)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {colorOptions.length ? (
          <View style={styles.section}>
            <Text style={styles.label}>Màu sắc</Text>
            <View style={styles.options}>
              {colorOptions.map((c) => (
                <Chip key={c.id} label={c.name} swatch={c.hex} selected={colorId === c.id} dimmed={!inStock(c.id, sizeId)} onPress={() => setPickedColor(c.id)} />
              ))}
            </View>
          </View>
        ) : null}

        {sizeOptions.length ? (
          <View style={styles.section}>
            <Text style={styles.label}>Size</Text>
            <View style={styles.options}>
              {sizeOptions.map((s) => (
                <Chip key={s.id} label={s.name} selected={sizeId === s.id} dimmed={!inStock(colorId, s.id)} onPress={() => setPickedSize(s.id)} />
              ))}
            </View>
          </View>
        ) : null}

        {variant ? (
          <Text style={[styles.stock, stock <= 0 && styles.stockOut]}>
            {stock > 0 ? `Còn ${stock} sản phẩm${inCart ? ` · Trong giỏ: ${inCart}` : ''}` : 'Hết hàng'}
          </Text>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.label}>Thông tin sản phẩm</Text>
          <View style={styles.infoBox}>
            <InfoRow label="Danh mục" value={product.category_name} />
            {product.brand_name ? <InfoRow label="Thương hiệu" value={product.brand_name} /> : null}
            <InfoRow label="Mã SKU" value={variant ? variant.sku : 'Chọn màu và size để xem'} />
            <InfoRow
              label="Tình trạng"
              value={variant ? (stock > 0 ? `Còn ${stock} sản phẩm` : 'Hết hàng') : variants.some((v) => Number(v.stock) > 0) ? 'Còn hàng' : 'Hết hàng'}
              last
            />
          </View>
        </View>

        {product.description ? (
          <View style={styles.section}>
            <Text style={styles.label}>Mô tả</Text>
            <Text style={styles.desc} numberOfLines={descOpen ? undefined : 5}>{product.description}</Text>
            {product.description.length > 200 ? (
              <Pressable onPress={() => setDescOpen((v) => !v)} hitSlop={8} role="button">
                <Text style={styles.more}>{descOpen ? 'Thu gọn' : 'Xem thêm'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <ReviewSection productId={product.id} />
        <RelatedProducts productId={product.id} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <QuantityStepper value={quantity} onChange={setQty} max={Math.max(room, 1)} disabled={!canAdd} />
        <Button
          title={cta}
          style={styles.cta}
          disabled={!canAdd}
          loading={add.isPending}
          onPress={() => {
            // Xem sản phẩm tự do, nhưng thêm vào giỏ thì cần đăng nhập
            if (status !== 'authenticated') {
              Alert.alert('Cần đăng nhập', 'Hãy đăng nhập hoặc tạo tài khoản để thêm sản phẩm vào giỏ hàng.', [
                { text: 'Để sau', style: 'cancel' },
                { text: 'Đăng nhập', onPress: () => router.push('/login') },
              ]);
              return;
            }
            if (adding.current || add.isPending) return;
            adding.current = true;
            add.mutate({ variantId: variant.id, quantity });
          }}
        />
      </View>

      <AddedToast
        toast={toast}
        bottom={insets.bottom + 84}
        onClose={() => setToast(null)}
        onView={() => {
          setToast(null);
          goToTab(router, '/cart');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: space.xl },
  actions: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 8 },
  circle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.92)' },
  discount: { position: 'absolute', top: 12, left: 12, backgroundColor: colors.danger, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  discountText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  thumbs: { paddingHorizontal: space.lg, paddingTop: space.md, gap: 8 },
  thumbWrap: { borderRadius: 8, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  thumbOn: { borderColor: colors.primary },
  thumb: { width: 56, height: 70 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  ratingText: { fontSize: 13, color: colors.muted },
  infoBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, padding: space.md },
  infoBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { fontSize: 14, color: colors.muted },
  infoValue: { fontSize: 14, color: colors.text, flexShrink: 1, textAlign: 'right' },
  more: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  dots: { position: 'absolute', left: 0, right: 0, bottom: 12, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.65)' },
  dotOn: { width: 18, backgroundColor: colors.white },
  priceSale: { color: colors.sale },
  saveTag: { fontSize: 12, fontWeight: '800', color: colors.sale, backgroundColor: colors.dangerSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  delivery: { gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  deliveryText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  section: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: 8 },
  name: { fontSize: 21, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  meta: { fontSize: 13, color: colors.muted },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  price: { fontSize: 24, fontWeight: '900', color: colors.text, letterSpacing: -0.4 },
  compare: { fontSize: 14, color: colors.muted, textDecorationLine: 'line-through' },
  label: { fontSize: 15, fontWeight: '600', color: colors.text },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stock: { paddingHorizontal: space.lg, paddingTop: space.md, fontSize: 13, color: colors.muted },
  stockOut: { color: colors.danger },
  desc: { fontSize: 14, lineHeight: 21, color: colors.text },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cta: { flex: 1 },
});
