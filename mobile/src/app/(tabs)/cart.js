import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { keepPreviousData, useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errMsg } from '@/api/client';
import { removeCartItem, updateCartItem } from '@/api/cart';
import { useAuth } from '@/auth/AuthProvider';
import { quoteOrder } from '@/api/orders';
import Button from '@/components/Button';
import Card from '@/components/Card';
import CartItemRow from '@/components/CartItemRow';
import EmptyState from '@/components/EmptyState';
import KeyboardView from '@/components/KeyboardView';
import LoginPanel from '@/components/LoginPanel';
import Loading from '@/components/Loading';
import PriceSummary from '@/components/PriceSummary';
import { CART_KEY, QUOTE_KEY, cartIssueCount, cartSignature, useCart } from '@/utils/useCart';
import { money } from '@/utils/format';
import { useFocusRefresh, usePullRefresh } from '@/utils/useRefresh';
import { goneVariantId } from '@/utils/viMessage';
import { colors, radius, space } from '@/utils/theme';

// Giỏ hàng gắn với tài khoản: chưa đăng nhập thì mời đăng nhập thay vì gọi API
export default function Cart() {
  const { status } = useAuth();
  if (status !== 'authenticated') {
    return <LoginPanel title="Đăng nhập để xem giỏ hàng" message="Giỏ hàng gắn với tài khoản của bạn. Hãy đăng nhập để xem và thanh toán." />;
  }
  return <CartScreen />;
}

function CartScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const cart = useCart();
  const items = cart.data?.items ?? [];

  // Lấy lại giỏ mỗi khi mở lại tab (tồn kho có thể đã đổi từ lần xem trước)
  useFocusRefresh(CART_KEY);
  const { refreshing, onRefresh } = usePullRefresh(cart.refetch);

  // ---- đổi số lượng / xóa: backend trả về cả giỏ mới nên ghi thẳng vào cache ----
  const onCartError = (title) => (e) => {
    Alert.alert(title, errMsg(e));
    queryClient.invalidateQueries({ queryKey: CART_KEY }); // dữ liệu có thể đã lệch: tải lại cho chắc
  };
  const setCart = (data) => queryClient.setQueryData(CART_KEY, data);
  const update = useMutation({
    mutationKey: ['cart-mutate'],
    mutationFn: updateCartItem,
    onSuccess: setCart,
    onError: onCartError('Không cập nhật được số lượng'),
  });
  const remove = useMutation({
    mutationKey: ['cart-mutate'],
    mutationFn: removeCartItem,
    onSuccess: setCart,
    onError: onCartError('Không xóa được sản phẩm'),
  });
  // Khóa mọi nút khi có yêu cầu đang chạy: tránh gửi chồng và phản hồi về sai thứ tự
  const busy = useIsMutating({ mutationKey: ['cart-mutate'] }) > 0;

  const confirmRemove = (item) =>
    Alert.alert('Xóa khỏi giỏ hàng?', `${item.product_name} (${[item.color_name, item.size_name].filter(Boolean).join(' / ')})`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => remove.mutate(item.id) },
    ]);

  // ---- mã giảm giá: xem trước qua POST /orders/quote ----
  const [input, setInput] = useState('');
  const [code, setCode] = useState(null); // mã đang được áp dụng (đã bấm "Áp dụng")
  const sig = cartSignature(cart.data);
  const quote = useQuery({
    queryKey: [...QUOTE_KEY, sig, code ?? ''],
    queryFn: () => quoteOrder({ couponCode: code }),
    enabled: items.length > 0,
    placeholderData: keepPreviousData, // đổi số lượng thì giữ số cũ (làm mờ) thay vì nhấp nháy
  });
  const quoteOk = !!quote.data && !quote.isError;
  const quoteMsg = quote.isError ? errMsg(quote.error) : null;
  // Báo giá lỗi vì một sản phẩm đã ngừng bán (CMS ngừng bán khi khách đang giữ trong giỏ): đánh dấu đúng dòng đó
  const goneId = goneVariantId(quoteMsg);
  const couponError = code && quoteMsg && goneId == null ? quoteMsg : null;
  const quoteFailed = !!quoteMsg && !code && goneId == null; // lỗi báo giá không liên quan mã giảm giá (mạng...)
  const couponApplied = !!code && quoteOk && !quote.isPlaceholderData;

  const applyCoupon = () => {
    const c = input.trim();
    if (!c) return;
    setCode(c);
    setInput(c);
  };
  const clearCoupon = () => {
    setCode(null);
    setInput('');
  };

  // Giỏ đã trống (vừa đặt hàng xong / xóa hết) thì bỏ mã cũ để lần mua sau không dính mã
  const cartEmpty = !!cart.data && items.length === 0;
  useEffect(() => {
    if (cartEmpty) {
      setCode(null);
      setInput('');
    }
  }, [cartEmpty]);

  const issues = cartIssueCount(cart.data, goneId);
  const canCheckout = items.length > 0 && issues === 0 && !busy && !(code && !couponApplied);
  const goCheckout = () =>
    router.push({ pathname: '/checkout', params: couponApplied ? { coupon: code } : {} });

  if (cart.isPending) return <Loading />;
  if (cart.isError && !cart.data) {
    return <EmptyState icon="cloud-offline-outline" title="Không tải được giỏ hàng" message={errMsg(cart.error)} actionLabel="Thử lại" onAction={() => cart.refetch()} />;
  }
  if (!items.length) {
    return (
      <EmptyState
        icon="cart-outline"
        title="Giỏ hàng trống"
        message="Hãy chọn vài món bạn thích nhé."
        actionLabel="Đi mua sắm"
        onAction={() => router.navigate('/shop')}
      />
    );
  }

  const header =
    issues > 0 ? (
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          {issues} sản phẩm hết hàng, vượt tồn kho hoặc đã ngừng bán. Hãy điều chỉnh hoặc xóa để tiếp tục thanh toán.
        </Text>
      </View>
    ) : null;

  const footer = (
    <View style={styles.footerWrap}>
      <Card style={styles.box}>
        <Text style={styles.boxTitle}>Mã giảm giá</Text>
        <View style={styles.couponRow}>
          <TextInput
            style={styles.couponInput}
            value={input}
            onChangeText={setInput}
            placeholder="Nhập mã giảm giá"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={applyCoupon}
          />
          <Button
            title="Áp dụng"
            variant="outline"
            style={styles.couponBtn}
            disabled={!input.trim() || input.trim() === code}
            loading={!!code && quote.isFetching && input.trim() === code}
            onPress={applyCoupon}
          />
        </View>
        {couponApplied ? (
          <View style={styles.couponMsgRow}>
            <Text style={styles.couponOk}>Đã áp dụng mã {code}: giảm {money(quote.data.discount_amount - (quote.data.group_discount ?? 0))}</Text>
            <Pressable onPress={clearCoupon} hitSlop={8}><Text style={styles.couponClear}>Bỏ mã</Text></Pressable>
          </View>
        ) : couponError ? (
          <View style={styles.couponMsgRow}>
            <Text style={styles.couponErr}>{couponError}</Text>
            <Pressable onPress={clearCoupon} hitSlop={8}><Text style={styles.couponClear}>Bỏ mã</Text></Pressable>
          </View>
        ) : null}
      </Card>

      <Card style={styles.box}>
        <PriceSummary
          subtotal={cart.data.subtotal}
          discount={quoteOk ? (couponApplied ? quote.data.discount_amount : (quote.data.group_discount ?? 0)) : 0}
          groupDiscount={quoteOk ? (quote.data.group_discount ?? 0) : 0}
          couponCode={couponApplied ? code : null}
          shipping={quoteOk ? quote.data.shipping_fee : null}
          total={quoteOk ? quote.data.total_amount : null}
          dim={quote.isFetching && !!quote.data}
        />
        {quoteFailed ? (
          <View style={styles.couponMsgRow}>
            <Text style={styles.couponErr}>Chưa tính được phí vận chuyển và tổng tiền.</Text>
            <Pressable onPress={() => quote.refetch()} hitSlop={8}><Text style={styles.couponClear}>Thử lại</Text></Pressable>
          </View>
        ) : null}
      </Card>
    </View>
  );

  const payable = quoteOk ? quote.data.total_amount : cart.data.subtotal;

  return (
    <KeyboardView style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        extraData={goneId}
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        refreshing={refreshing}
        onRefresh={onRefresh}
        renderItem={({ item }) => (
          <CartItemRow
            item={item}
            busy={busy}
            goneId={goneId}
            onOpen={() => router.push(`/product/${item.product_id}`)}
            onChangeQty={(quantity) => update.mutate({ itemId: item.id, quantity })}
            onRemove={() => confirmRemove(item)}
          />
        )}
      />

      <View style={styles.bar}>
        <View style={styles.barTotal}>
          <Text style={styles.barLabel}>{quoteOk ? 'Tổng cộng' : 'Tạm tính'}</Text>
          <Text style={styles.barValue}>{money(payable)}</Text>
        </View>
        <Button title="Thanh toán" style={styles.barBtn} disabled={!canCheckout} onPress={goCheckout} />
      </View>
    </KeyboardView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: space.lg, paddingBottom: space.xl },
  banner: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: space.md, marginBottom: space.md, borderWidth: 1, borderColor: colors.danger },
  bannerText: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  footerWrap: { gap: space.md, marginTop: space.lg },
  box: { padding: space.md, gap: space.sm },
  boxTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  couponRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  couponInput: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  couponBtn: { minWidth: 96 },
  couponMsgRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  couponOk: { flex: 1, color: colors.primary, fontSize: 13 },
  couponErr: { flex: 1, color: colors.danger, fontSize: 13 },
  couponClear: { color: colors.muted, fontSize: 13, textDecorationLine: 'underline' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  barTotal: { flex: 1 },
  barLabel: { fontSize: 12, color: colors.muted },
  barValue: { fontSize: 18, fontWeight: '700', color: colors.primary },
  barBtn: { minWidth: 140 },
});
