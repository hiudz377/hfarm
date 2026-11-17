import { useMemo, useRef, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errMsg } from '@/api/client';
import { addToCart } from '@/api/cart';
import { useAuth } from '@/auth/AuthProvider';
import { fetchProduct } from '@/api/products';
import Button from '@/components/Button';
import Chip from '@/components/Chip';
import EmptyState from '@/components/EmptyState';
import Loading from '@/components/Loading';
import Photo from '@/components/Photo';
import QuantityStepper from '@/components/QuantityStepper';
import { money } from '@/utils/format';
import { goBack, goToTab } from '@/utils/nav';
import { CART_KEY, useCart } from '@/utils/useCart';
import { colors, space } from '@/utils/theme';

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
      Alert.alert('Đã thêm vào giỏ hàng', product.name, [
        { text: 'Tiếp tục mua' },
        // dismissTo: quay về màn (tabs) đã có rồi chọn tab Giỏ hàng. navigate('/cart') sẽ chồng thêm một bản (tabs) mới.
        { text: 'Xem giỏ hàng', onPress: () => goToTab(router, '/cart') },
      ]);
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
  const comparePrice = variant && variant.compare_at_price > variant.price ? variant.compare_at_price : null;

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
            data={pics}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item }) => <Photo uri={item} style={{ width, height: imgHeight }} />}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          />
          {pics.length > 1 ? (
            <View style={styles.counter}>
              <Text style={styles.counterText}>{page + 1}/{pics.length}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.meta}>{[product.brand_name, product.category_name].filter(Boolean).join(' · ')}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{priceText}</Text>
            {comparePrice ? <Text style={styles.compare}>{money(comparePrice)}</Text> : null}
          </View>
        </View>

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

        {product.description ? (
          <View style={styles.section}>
            <Text style={styles.label}>Mô tả</Text>
            <Text style={styles.desc}>{product.description}</Text>
          </View>
        ) : null}
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: space.xl },
  counter: { position: 'absolute', right: 12, bottom: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  counterText: { color: colors.white, fontSize: 12 },
  section: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: 8 },
  name: { fontSize: 20, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.muted },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  price: { fontSize: 22, fontWeight: '700', color: colors.primary },
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
