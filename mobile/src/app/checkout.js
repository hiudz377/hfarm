import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errMsg } from '@/api/client';
import { fetchAddresses } from '@/api/addresses';
import { fetchCart } from '@/api/cart';
import { createGiftOrder, fetchGiftOptions } from '@/api/gifts';
import { createOrder, quoteOrder } from '@/api/orders';
import { fetchPaymentMethods } from '@/api/payments';
import Button from '@/components/Button';
import Card from '@/components/Card';
import GiftCardView from '@/components/GiftCardView';
import KeyboardView from '@/components/KeyboardView';
import EmptyState from '@/components/EmptyState';
import Loading from '@/components/Loading';
import PriceSummary from '@/components/PriceSummary';
import { giftColors, serif } from '@/utils/giftTheme';
import { giftPayload, resetGiftDraft, useGiftDraft } from '@/utils/giftDraft';
import { goBack, goToTab } from '@/utils/nav';
import { goneVariantId } from '@/utils/viMessage';
import { PAYMENT_METHODS } from '@/utils/payment';
import { ADDRESSES_KEY, CART_KEY, QUOTE_KEY, afterOrderPlaced, cartIssueCount, cartSignature, useCart } from '@/utils/useCart';
import { etaText, money } from '@/utils/format';
import { colors, radius, space } from '@/utils/theme';

const fullAddress = (a) => [a.address_detail, a.ward, a.district, a.province].filter(Boolean).join(', ');

function Section({ title, children }) {
  return (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </Card>
  );
}

function Radio({ selected, title, icon, children, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.option, selected && styles.optionOn]} role="radio" aria-checked={selected}>
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.primary : colors.muted} />
      {icon ? (
        <View style={[styles.optionIcon, selected && styles.optionIconOn]}>
          <Ionicons name={icon} size={20} color={selected ? colors.white : colors.primary} />
        </View>
      ) : null}
      <View style={styles.optionBody}>
        <Text style={styles.optionTitle}>{title}</Text>
        {children}
      </View>
    </Pressable>
  );
}

export default function Checkout() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const cart = useCart();
  const items = cart.data?.items ?? [];

  // ---- đơn quà tặng (mở từ màn viết thiệp bằng ?gift=1): chỉ chuyển khoản, gửi kèm thiệp + tùy chọn ----
  const isGift = params.gift === '1';
  const draft = useGiftDraft();
  const giftOptionsQ = useQuery({ queryKey: ['gift-options'], queryFn: fetchGiftOptions, staleTime: 10 * 60 * 1000, enabled: isGift });
  const giftCard = isGift && !draft.noCard ? giftOptionsQ.data?.cards.find((c) => c.id === draft.templateId) ?? giftOptionsQ.data?.cards[0] ?? null : null;
  const giftOccasion = giftOptionsQ.data?.occasions.find((o) => o.value === draft.occasion)?.label ?? null;

  // ---- địa chỉ ----
  const addressesQ = useQuery({ queryKey: ADDRESSES_KEY, queryFn: fetchAddresses });
  const addresses = addressesQ.data ?? [];
  const [selectedId, setSelectedId] = useState(null);
  // Chưa chọn thì dùng địa chỉ mặc định (backend xếp mặc định lên đầu), không có thì lấy địa chỉ đầu tiên
  const address = addresses.find((a) => a.id === selectedId) ?? addresses.find((a) => a.is_default) ?? addresses[0] ?? null;

  // Vừa thêm địa chỉ ở màn address-form (quay về kèm ?newAddressId=): chọn luôn địa chỉ đó, mỗi id chỉ xử lý một lần
  const newAddressId = params.newAddressId ? Number(params.newAddressId) : null;
  const handledNew = useRef(null);
  useEffect(() => {
    if (newAddressId && handledNew.current !== newAddressId && addresses.some((a) => a.id === newAddressId)) {
      handledNew.current = newAddressId;
      setSelectedId(newAddressId);
    }
  }, [newAddressId, addresses]);

  // ---- thanh toán, ghi chú, mã giảm giá (mã truyền từ màn Giỏ hàng qua ?coupon=) ----
  const [method, setMethod] = useState('COD');
  const [note, setNote] = useState('');
  const [coupon, setCoupon] = useState(() => (params.coupon ? String(params.coupon) : null));

  // Phương thức do server quyết định: chuyển khoản chỉ hiện khi cửa hàng đã cấu hình tài khoản ngân hàng
  const methodsQ = useQuery({ queryKey: ['payment-methods'], queryFn: fetchPaymentMethods, staleTime: 5 * 60 * 1000 });
  const allMethods = (methodsQ.data?.methods ?? [{ value: 'COD' }]).map((m) => ({ ...PAYMENT_METHODS.find((p) => p.value === m.value), ...m }))
    .filter((m) => m.title);
  // Đơn quà không có COD: người nhận sẽ phải trả tiền món quà của chính mình (backend cũng từ chối)
  const available = isGift ? allMethods.filter((m) => m.value === 'BANK_TRANSFER') : allMethods;
  const bank = available.find((m) => m.value === 'BANK_TRANSFER');
  // phương thức đã chọn bị tắt thì quay về COD; đơn quà chỉ có chuyển khoản (null nếu cửa hàng chưa bật)
  const chosen = isGift ? (bank ? 'BANK_TRANSFER' : null) : (available.some((m) => m.value === method) ? method : 'COD');

  // ---- tiền: luôn lấy từ /orders/quote (cùng hàm tính với POST /orders). Có địa chỉ thì phí ship theo vùng của địa chỉ ----
  const quote = useQuery({
    queryKey: [...QUOTE_KEY, cartSignature(cart.data), coupon ?? '', address?.id ?? ''],
    queryFn: () => quoteOrder({ couponCode: coupon, addressId: address?.id }),
    enabled: items.length > 0 && !addressesQ.isPending,
  });
  const eta = etaText(quote.data?.shipping_zone);
  // Báo giá lỗi vì có sản phẩm đã ngừng bán (CMS ngừng bán khi đang nằm trong giỏ): chỉ cho quay lại giỏ để xóa
  const quoteMsg = quote.isError ? errMsg(quote.error) : null;
  const goneId = goneVariantId(quoteMsg);
  const issues = cartIssueCount(cart.data, goneId);

  // ---- đặt hàng ----
  const submitting = useRef(false); // chống bấm đúp: khóa ngay trong cùng nhịp bấm, không chờ state cập nhật

  const onOrderError = async (e) => {
    // Không có phản hồi (hết giờ, mất mạng): đơn CÓ THỂ đã được tạo. Giỏ trống = đã tạo, tránh bắt khách đặt lại.
    if (!e?.response) {
      let known = false;
      try {
        const fresh = await queryClient.fetchQuery({ queryKey: CART_KEY, queryFn: fetchCart, staleTime: 0 });
        if (!fresh.items.length) {
          afterOrderPlaced(queryClient);
          Alert.alert(
            'Đơn hàng có thể đã được tạo',
            'Kết nối bị gián đoạn khi đặt hàng nhưng giỏ hàng của bạn đã trống, nên đơn nhiều khả năng đã được ghi nhận. Hãy kiểm tra ở mục "Đơn hàng" trước khi đặt lại.',
            [{ text: 'Xem đơn hàng', onPress: () => goToTab(router, '/orders') }],
          );
          return;
        }
        known = true; // giỏ vẫn còn nguyên: chắc chắn chưa có đơn nào
      } catch {
        // vẫn không có mạng: báo lỗi bên dưới
      }
      Alert.alert(
        'Chưa đặt được hàng',
        known ? errMsg(e) : `${errMsg(e)}\n\nChưa rõ đơn đã được tạo hay chưa. Nếu nghi ngờ, hãy kiểm tra mục "Đơn hàng" trước khi đặt lại.`,
      );
      return;
    }

    // Có phản hồi lỗi: dữ liệu (giỏ, tồn kho, mã giảm giá, địa chỉ) có thể đã đổi, tải lại hết
    const msg = errMsg(e);
    queryClient.invalidateQueries({ queryKey: CART_KEY });
    queryClient.invalidateQueries({ queryKey: QUOTE_KEY });
    queryClient.invalidateQueries({ queryKey: ADDRESSES_KEY });
    queryClient.invalidateQueries({ queryKey: ['product'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    if (goneVariantId(msg) != null) {
      Alert.alert(
        'Sản phẩm đã ngừng bán',
        'Giỏ hàng có sản phẩm đã ngừng bán. Giỏ hàng đã được cập nhật, vui lòng xóa sản phẩm đó rồi đặt lại.',
        [{ text: 'Về giỏ hàng', onPress: () => goToTab(router, '/cart') }],
      );
    } else if (/tồn kho/i.test(msg)) {
      Alert.alert(
        'Sản phẩm không đủ hàng',
        `${msg}\n\nGiỏ hàng đã được cập nhật theo tồn kho mới. Vui lòng điều chỉnh số lượng rồi đặt lại.`,
        [{ text: 'Về giỏ hàng', onPress: () => goToTab(router, '/cart') }],
      );
    } else {
      Alert.alert('Không đặt được hàng', msg);
    }
  };

  const place = useMutation({
    mutationFn: isGift ? createGiftOrder : createOrder,
    onSuccess: (order, vars) => {
      router.replace({
        pathname: '/order-success',
        params: {
          id: String(order.id), code: order.order_code, total: String(order.total_amount), method: isGift ? 'BANK_TRANSFER' : vars.paymentMethod,
          eta: etaText(order.shipping_zone) ?? '', gift: isGift ? '1' : '',
        },
      });
      afterOrderPlaced(queryClient);
      if (isGift) resetGiftDraft();
    },
    onError: onOrderError,
    onSettled: () => {
      submitting.current = false;
    },
  });

  const quoteReady = !!quote.data && !quote.isFetching && !quote.isError;
  let blocked = null;
  if (issues > 0) blocked = 'Giỏ hàng có sản phẩm hết hàng, vượt tồn kho hoặc đã ngừng bán.';
  else if (isGift && !methodsQ.isPending && !chosen) blocked = 'Cửa hàng chưa bật chuyển khoản nên chưa nhận được đơn quà.';
  else if (isGift && !draft.noCard && !draft.message.trim()) blocked = 'Thiệp chưa có lời nhắn. Hãy quay lại viết thiệp (hoặc chọn không kèm thiệp).';
  else if (!address) blocked = 'Hãy chọn hoặc thêm địa chỉ giao hàng.';
  else if (!quoteReady) blocked = quote.isError ? 'Chưa tính được tổng tiền.' : null;
  const canPlace = !blocked && quoteReady && !place.isPending;

  const onPlace = () => {
    if (submitting.current || place.isPending || !canPlace) return;
    submitting.current = true;
    place.mutate(isGift
      ? { addressId: address.id, couponCode: coupon, note: note.trim(), gift: giftPayload(draft) }
      : { addressId: address.id, paymentMethod: chosen, couponCode: coupon, note: note.trim() });
  };

  // ---- trạng thái cả màn ----
  if (place.isSuccess) return <Loading />; // đang chuyển sang màn thành công: tránh nháy "giỏ trống"
  if (cart.isPending) return <Loading />;
  if (cart.isError && !cart.data) {
    return <EmptyState icon="cloud-offline-outline" title="Không tải được giỏ hàng" message={errMsg(cart.error)} actionLabel="Thử lại" onAction={() => cart.refetch()} />;
  }
  if (!items.length) {
    return <EmptyState icon="cart-outline" title="Giỏ hàng trống" message="Không có gì để thanh toán." actionLabel="Đi mua sắm" onAction={() => goToTab(router, '/shop')} />;
  }

  return (
    <KeyboardView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {issues > 0 ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>Có sản phẩm hết hàng, vượt tồn kho hoặc đã ngừng bán. Hãy quay lại giỏ hàng để điều chỉnh.</Text>
            <Button title="Về giỏ hàng" variant="outline" onPress={() => goToTab(router, '/cart')} />
          </View>
        ) : null}

        {isGift ? (
          <View style={styles.giftBox}>
            <View style={styles.giftHead}>
              <Text style={styles.giftTitle}>🎁 Đơn quà tặng</Text>
              <Pressable onPress={() => goBack(router, '/gift-card')} hitSlop={8} role="button" aria-label="Sửa thiệp">
                <Text style={styles.giftEdit}>Sửa thiệp</Text>
              </Pressable>
            </View>
            <View style={styles.giftRow}>
              {giftCard ? <GiftCardView card={giftCard} message={draft.message} sender={draft.sender.trim()} width={112} compact /> : null}
              <View style={styles.giftInfo}>
                {giftOccasion ? <Text style={styles.giftLine}>Dịp: {giftOccasion}</Text> : null}
                <Text style={styles.giftLine}>{draft.noCard ? 'Không kèm thiệp' : 'Thiệp in giấy bỏ trong hộp'}</Text>
                <Text style={styles.giftLine}>{draft.hidePrices ? 'Phiếu giao hàng không ghi giá' : 'Phiếu giao hàng có ghi giá'}</Text>
                <Text style={styles.giftLine}>{draft.wrap ? 'Có gói quà' : 'Không gói quà'}</Text>
                <Text style={styles.giftLine}>Thanh toán chuyển khoản</Text>
              </View>
            </View>
          </View>
        ) : null}

        <Section title="Địa chỉ giao hàng">
          {addressesQ.isPending ? (
            <ActivityIndicator color={colors.primary} />
          ) : addressesQ.isError && !addressesQ.data ? (
            <View style={styles.inlineErr}>
              <Text style={styles.errText}>{errMsg(addressesQ.error)}</Text>
              <Button title="Thử lại" variant="outline" onPress={() => addressesQ.refetch()} />
            </View>
          ) : (
            <>
              {addresses.length === 0 ? <Text style={styles.muted}>Bạn chưa có địa chỉ giao hàng nào.</Text> : null}
              {addresses.map((a) => (
                <Radio key={a.id} selected={address?.id === a.id} onPress={() => setSelectedId(a.id)}
                  title={`${a.recipient_name} · ${a.phone}`}>
                  <Text style={styles.muted}>{fullAddress(a)}</Text>
                  {a.is_default ? <Text style={styles.tag}>Mặc định</Text> : null}
                </Radio>
              ))}
              <Button
                title={addresses.length ? '+ Thêm địa chỉ mới' : '+ Thêm địa chỉ giao hàng'}
                variant="outline"
                onPress={() => router.push({ pathname: '/address-form', params: { from: 'checkout' } })}
              />
            </>
          )}
        </Section>

        <Section title="Phương thức thanh toán">
          {isGift && !methodsQ.isPending && !bank ? <Text style={styles.muted}>Đơn quà chỉ thanh toán bằng chuyển khoản, nhưng cửa hàng chưa bật chuyển khoản.</Text> : null}
          {available.map((m) => (
            <Radio key={m.value} selected={chosen === m.value} onPress={() => setMethod(m.value)} title={m.title} icon={m.icon}>
              <Text style={styles.muted}>{m.hint}</Text>
            </Radio>
          ))}
          {chosen === 'BANK_TRANSFER' && bank ? (
            <View style={styles.hintBox}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.hintText}>
                Sau khi đặt hàng, mã QR hiện ngay để bạn quét và chuyển đúng số tiền.
                {' '}{bank.auto_confirm ? 'Đơn tự cập nhật khi tiền về.' : 'Cửa hàng sẽ xác nhận khi nhận được tiền.'}
                {bank.hold_minutes ? ` Đơn được giữ ${bank.hold_minutes >= 60 ? `${Math.round(bank.hold_minutes / 60)} giờ` : `${bank.hold_minutes} phút`}, quá hạn chưa thanh toán sẽ tự hủy.` : ''}
              </Text>
            </View>
          ) : null}
        </Section>

        <Section title="Ghi chú cho cửa hàng">
          <TextInput
            style={styles.note}
            value={note}
            onChangeText={setNote}
            placeholder="Ví dụ: giao giờ hành chính, gọi trước khi giao..."
            placeholderTextColor={colors.muted}
            multiline
            maxLength={500}
          />
        </Section>

        <Section title={`Đơn hàng (${items.length} sản phẩm)`}>
          {items.map((i) => (
            <View key={i.id} style={styles.line}>
              <Text style={styles.lineName} numberOfLines={2}>
                {i.product_name}
                <Text style={styles.muted}>{`  ${[i.color_name, i.size_name].filter(Boolean).join(' / ')}`}</Text>
              </Text>
              <Text style={styles.lineQty}>x{i.quantity}</Text>
              <Text style={styles.linePrice}>{money(i.price * i.quantity)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          {quote.isPending ? (
            <ActivityIndicator color={colors.primary} />
          ) : quote.isError ? (
            <View style={styles.inlineErr}>
              <Text style={styles.errText}>{goneId != null ? 'Giỏ hàng có sản phẩm đã ngừng bán. Hãy quay lại giỏ hàng và xóa sản phẩm đó.' : quoteMsg}</Text>
              <View style={styles.errActions}>
                {goneId != null ? <Button title="Về giỏ hàng" variant="outline" style={styles.flex} onPress={() => goToTab(router, '/cart')} /> : null}
                {coupon ? <Button title="Bỏ mã giảm giá" variant="outline" style={styles.flex} onPress={() => setCoupon(null)} /> : null}
                <Button title="Thử lại" variant="outline" style={styles.flex} onPress={() => quote.refetch()} />
              </View>
            </View>
          ) : (
            <>
              {coupon ? (
                <View style={styles.couponRow}>
                  <Text style={styles.muted}>Mã giảm giá: {coupon}</Text>
                  <Pressable onPress={() => setCoupon(null)} hitSlop={8}><Text style={styles.link}>Bỏ mã</Text></Pressable>
                </View>
              ) : null}
              <PriceSummary
                subtotal={quote.data.subtotal}
                discount={quote.data.discount_amount}
                groupDiscount={quote.data.group_discount ?? 0}
                couponCode={coupon}
                shipping={quote.data.shipping_fee}
                total={quote.data.total_amount}
                dim={quote.isFetching}
              />
              {eta ? (
                <View style={styles.eta}>
                  <Ionicons name="bicycle-outline" size={18} color={colors.primary} />
                  <Text style={styles.etaText}>Dự kiến giao trong {eta}</Text>
                </View>
              ) : null}
            </>
          )}
        </Section>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        {blocked ? <Text style={styles.blocked}>{blocked}</Text> : null}
        <View style={styles.footerRow}>
          <View style={styles.flex}>
            <Text style={styles.footerLabel}>Tổng thanh toán</Text>
            {/* quote lỗi thì react-query vẫn giữ data của lần thành công trước: không hiện tổng cũ gây hiểu nhầm */}
            <Text style={styles.footerTotal}>{quote.data && !quote.isError ? money(quote.data.total_amount) : '--'}</Text>
          </View>
          <Button title={isGift ? 'Đặt đơn quà' : 'Đặt hàng'} style={styles.placeBtn} disabled={!canPlace} loading={place.isPending} onPress={onPlace} />
        </View>
      </View>
    </KeyboardView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: space.lg, gap: space.md, paddingBottom: space.xl },
  flex: { flex: 1 },
  giftBox: { gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: giftColors.rose, borderWidth: 1, borderColor: giftColors.roseLine },
  giftHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  giftTitle: { fontSize: 16, fontWeight: '800', color: giftColors.wine, fontFamily: serif },
  giftEdit: { fontSize: 13, fontWeight: '800', color: giftColors.wine, textDecorationLine: 'underline' },
  giftRow: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  giftInfo: { flex: 1, gap: 4 },
  giftLine: { fontSize: 13, color: giftColors.ink, lineHeight: 18 },
  hintBox: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  hintText: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 17 },
  optionIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  optionIconOn: { backgroundColor: colors.primary },
  eta: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: space.md, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  etaText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.primary },
  banner: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: colors.danger },
  bannerText: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  section: { padding: space.md, gap: space.sm },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  option: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionBody: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  tag: { alignSelf: 'flex-start', marginTop: 2, fontSize: 11, color: colors.primary, fontWeight: '700', borderWidth: 1, borderColor: colors.primary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  note: { minHeight: 72, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, fontSize: 14, color: colors.text, backgroundColor: colors.surface },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  lineName: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  lineQty: { fontSize: 13, color: colors.muted },
  linePrice: { fontSize: 13, color: colors.text, minWidth: 84, textAlign: 'right' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: space.xs },
  inlineErr: { gap: space.sm },
  errText: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  errActions: { flexDirection: 'row', gap: space.sm },
  couponRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: colors.muted, fontSize: 13, textDecorationLine: 'underline' },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, gap: 6, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  blocked: { color: colors.danger, fontSize: 12 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  footerLabel: { fontSize: 12, color: colors.muted },
  footerTotal: { fontSize: 18, fontWeight: '700', color: colors.primary },
  placeBtn: { minWidth: 150 },
});
