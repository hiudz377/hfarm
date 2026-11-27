import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errMsg } from '@/api/client';
import { addToCart, removeCartItem } from '@/api/cart';
import { fetchGiftOptions } from '@/api/gifts';
import EmptyState from '@/components/EmptyState';
import Field from '@/components/Field';
import GiftCardView from '@/components/GiftCardView';
import KeyboardView from '@/components/KeyboardView';
import Loading from '@/components/Loading';
import { money } from '@/utils/format';
import { giftColors, OCCASION_EMOJI, serif } from '@/utils/giftTheme';
import { setGiftDraft, useGiftDraft } from '@/utils/giftDraft';
import { CART_KEY, useCart } from '@/utils/useCart';
import { radius, space } from '@/utils/theme';

function Block({ title, hint, children }) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function Toggle({ icon, title, sub, value, onValueChange }) {
  return (
    <View style={styles.toggle}>
      <View style={styles.toggleIcon}><Ionicons name={icon} size={20} color={giftColors.wine} /></View>
      <View style={styles.flex}>
        <Text style={styles.toggleTitle}>{title}</Text>
        {sub ? <Text style={styles.hint}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: giftColors.wine, false: '#D9CDD1' }}
        thumbColor={giftColors.white}
        activeThumbColor={giftColors.white}
        aria-label={title}
      />
    </View>
  );
}

// Viết thiệp: chọn mẫu, lời nhắn, người ký (thiệp hiện ngay khi gõ) + tùy chọn ẩn giá / gói quà, rồi sang thanh toán.
// Lấy hàng từ giỏ (quà đã chọn ở màn Quà tặng hoặc món bạn tự thêm vào giỏ).
export default function GiftCard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const cart = useCart();
  const draft = useGiftDraft();
  const options = useQuery({ queryKey: ['gift-options'], queryFn: fetchGiftOptions, staleTime: 10 * 60 * 1000 });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const opts = options.data;
  const occasion = draft.occasion ?? 'SURPRISE';
  // Mẫu hợp dịp này lên đầu, rồi mẫu dùng chung, cuối cùng mẫu của dịp khác
  const cards = useMemo(() => {
    if (!opts) return [];
    const rank = (c) => (c.occasions.includes(occasion) ? 0 : c.occasions.length === 0 ? 1 : 2);
    return [...opts.cards].sort((a, b) => rank(a) - rank(b));
  }, [opts, occasion]);
  const card = cards.find((c) => c.id === draft.templateId) ?? cards[0] ?? null;

  // Chưa chọn mẫu thì ghi mẫu đang hiện vào bản nháp (backend cũng tự dùng mẫu đầu khi có lời nhắn mà thiếu mẫu)
  useEffect(() => {
    if (card && draft.templateId !== card.id) setGiftDraft({ templateId: card.id });
  }, [card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (cart.isPending || options.isPending) return <Loading />;
  if (options.isError) {
    return <EmptyState icon="cloud-offline-outline" title="Không tải được thiệp" message={errMsg(options.error)} actionLabel="Thử lại" onAction={() => options.refetch()} />;
  }
  const items = cart.data?.items ?? [];
  if (!items.length) {
    return (
      <EmptyState
        icon="gift-outline"
        title="Giỏ hàng đang trống"
        message="Hãy chọn quà trước, rồi quay lại đây để viết thiệp."
        actionLabel="Chọn quà"
        onAction={() => router.replace('/gift')}
      />
    );
  }

  const wishes = opts.wishes[occasion] ?? [];
  const wrap = opts.wrap;
  const cardWidth = Math.min(width - space.lg * 2 - 48, 300);
  // Có món bạn tự thêm vào giỏ ngoài quà đã chọn: cảnh báo vì cả giỏ sẽ gói chung trong một đơn quà
  const others = draft.picked.length
    ? items.filter((l) => !draft.picked.includes(l.variant_id) && l.variant_id !== wrap?.variant_id)
    : [];
  const needMessage = !draft.noCard && !draft.message.trim();

  const goCheckout = async () => {
    if (busy) return;
    if (needMessage) { setError('Hãy viết lời nhắn, hoặc bật "Không kèm thiệp".'); return; }
    setError(null);
    setBusy(true);
    try {
      // Gói quà là một sản phẩm thường: thêm / bớt khỏi giỏ cho khớp lựa chọn để tổng tiền ở bước thanh toán đúng
      if (wrap) {
        const line = items.find((l) => l.variant_id === wrap.variant_id);
        let latest = null;
        if (draft.wrap && !line) latest = await addToCart({ variantId: wrap.variant_id, quantity: 1 });
        else if (!draft.wrap && line) latest = await removeCartItem(line.id);
        if (latest) queryClient.setQueryData(CART_KEY, latest);
      }
      router.push({ pathname: '/checkout', params: { gift: '1' } });
    } catch (e) {
      Alert.alert('Chưa thêm được gói quà', errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardView>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]} keyboardShouldPersistTaps="handled">
          <View style={styles.stage}>
            {draft.noCard ? (
              <View style={styles.noCard}>
                <Text style={styles.noCardEmoji}>🎁</Text>
                <Text style={styles.noCardText}>Đơn quà này không kèm thiệp</Text>
              </View>
            ) : (
              <View style={styles.tilt}>
                <GiftCardView card={card} message={draft.message} sender={draft.sender.trim()} width={cardWidth} />
              </View>
            )}
          </View>

          <Toggle
            icon="mail-unread-outline"
            title="Không kèm thiệp"
            sub="Chỉ gửi quà, không có thiệp trong hộp"
            value={draft.noCard}
            onValueChange={(v) => { setGiftDraft({ noCard: v }); setError(null); }}
          />

          {!draft.noCard ? (
            <>
              <Block title="Dịp tặng quà">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
                  {opts.occasions.map((o) => (
                    <Pressable
                      key={o.value}
                      onPress={() => setGiftDraft({ occasion: o.value, templateId: null })}
                      role="button"
                      aria-pressed={occasion === o.value}
                      style={[styles.pill, occasion === o.value && styles.pillOn]}
                    >
                      <Text style={styles.pillEmoji}>{OCCASION_EMOJI[o.value] ?? '🎁'}</Text>
                      <Text style={[styles.pillText, occasion === o.value && styles.pillTextOn]}>{o.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </Block>

              <Block title="Chọn mẫu thiệp">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
                  {cards.map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => setGiftDraft({ templateId: c.id })}
                      role="button"
                      aria-pressed={card?.id === c.id}
                      aria-label={`Mẫu thiệp ${c.name}`}
                      style={styles.thumb}
                    >
                      <View style={[styles.thumbFrame, card?.id === c.id && styles.thumbFrameOn]}>
                        <GiftCardView card={c} message="" sender="" width={84} compact />
                      </View>
                      <Text style={[styles.thumbName, card?.id === c.id && styles.thumbNameOn]} numberOfLines={1}>{c.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </Block>

              <Block title="Lời nhắn" hint="Bấm một gợi ý để dùng, rồi sửa lại cho hợp cách xưng hô của bạn.">
                <View style={styles.wishes}>
                  {wishes.map((w) => (
                    <Pressable
                      key={w}
                      onPress={() => { setGiftDraft({ message: w }); setError(null); }}
                      role="button"
                      aria-label={`Dùng lời chúc: ${w}`}
                      style={[styles.wish, draft.message === w && styles.wishOn]}
                    >
                      <Text style={styles.wishText}>{w}</Text>
                    </Pressable>
                  ))}
                </View>
                <Field
                  label="Nội dung thiệp"
                  value={draft.message}
                  onChangeText={(v) => { setGiftDraft({ message: v }); setError(null); }}
                  multiline
                  maxLength={opts.message_max}
                  placeholder="Viết điều bạn muốn nói với anh ấy..."
                  style={styles.message}
                  aria-label="Nội dung thiệp"
                />
                <Text style={styles.counter}>{[...draft.message].length}/{opts.message_max}</Text>
                <Field
                  label="Người gửi (ký tên)"
                  value={draft.sender}
                  onChangeText={(v) => setGiftDraft({ sender: v })}
                  maxLength={opts.sender_max}
                  placeholder="Ví dụ: Lan"
                  returnKeyType="done"
                  aria-label="Tên người gửi hiện trên thiệp"
                />
              </Block>
            </>
          ) : null}

          <Block title="Tùy chọn cho đơn quà">
            <Toggle
              icon="eye-off-outline"
              title="Ẩn giá trên phiếu giao hàng"
              sub="Phiếu cửa hàng bỏ vào hộp sẽ không ghi giá tiền"
              value={draft.hidePrices}
              onValueChange={(v) => setGiftDraft({ hidePrices: v })}
            />
            {wrap ? (
              <Toggle
                icon="gift-outline"
                title={`Gói quà (+${money(wrap.price)})`}
                sub="Cửa hàng gói hộp quà cẩn thận trước khi giao"
                value={draft.wrap}
                onValueChange={(v) => setGiftDraft({ wrap: v })}
              />
            ) : null}
            <View style={styles.info}>
              <Ionicons name="card-outline" size={18} color={giftColors.wine} />
              <Text style={styles.infoText}>Đơn quà thanh toán bằng chuyển khoản để bạn ấy không phải trả tiền món quà của mình.</Text>
            </View>
          </Block>

          {others.length ? (
            <View style={styles.warn}>
              <Ionicons name="alert-circle-outline" size={18} color={giftColors.gold} />
              <Text style={styles.warnText}>
                Giỏ còn {others.length} món khác ngoài quà đã chọn. Cả giỏ sẽ được gói chung trong đơn quà này; nếu là đồ của riêng bạn, hãy đặt đơn khác.
              </Text>
            </View>
          ) : null}

          {error ? <Text style={styles.error} role="alert">{error}</Text> : null}
        </ScrollView>
      </KeyboardView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
        <View style={styles.flex}>
          <Text style={styles.barLabel}>{items.length} món trong giỏ</Text>
          <Text style={styles.barTotal}>{money(cart.data?.subtotal ?? 0)}</Text>
        </View>
        <Pressable onPress={goCheckout} disabled={busy} role="button" style={[styles.barBtn, busy && styles.barBtnOff]}>
          <Text style={styles.barBtnText}>{busy ? 'Đang xử lý...' : 'Tiếp tục thanh toán'}</Text>
          <Ionicons name="arrow-forward" size={18} color={giftColors.wineDark} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: giftColors.cream },
  flex: { flex: 1 },
  scroll: { padding: space.lg, gap: space.lg },
  stage: { alignItems: 'center', paddingVertical: space.xl, borderRadius: radius.xl, backgroundColor: giftColors.rose, borderWidth: 1, borderColor: giftColors.roseLine },
  tilt: { transform: [{ rotate: '-1.5deg' }] },
  noCard: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  noCardEmoji: { fontSize: 44 },
  noCardText: { fontSize: 15, fontWeight: '700', color: giftColors.wine, fontFamily: serif },
  block: { gap: space.sm },
  label: { fontSize: 16, fontWeight: '800', color: giftColors.ink, fontFamily: serif },
  hint: { fontSize: 12, color: giftColors.muted, lineHeight: 17 },
  pills: { gap: space.sm, paddingRight: space.lg },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill,
    backgroundColor: giftColors.white, borderWidth: 1, borderColor: giftColors.roseLine,
  },
  pillOn: { backgroundColor: giftColors.wine, borderColor: giftColors.wine },
  pillEmoji: { fontSize: 16 },
  pillText: { fontSize: 13, fontWeight: '700', color: giftColors.ink },
  pillTextOn: { color: giftColors.white },
  thumbs: { gap: space.md, paddingRight: space.lg, paddingVertical: 4 },
  thumb: { alignItems: 'center', gap: 6, width: 92 },
  thumbFrame: { padding: 3, borderRadius: radius.md, borderWidth: 2, borderColor: 'transparent' },
  thumbFrameOn: { borderColor: giftColors.wine },
  thumbName: { fontSize: 12, color: giftColors.muted, textAlign: 'center' },
  thumbNameOn: { color: giftColors.wine, fontWeight: '800' },
  wishes: { gap: space.sm },
  wish: { padding: space.md, borderRadius: radius.md, backgroundColor: giftColors.white, borderWidth: 1, borderColor: giftColors.roseLine },
  wishOn: { borderColor: giftColors.wine, backgroundColor: giftColors.rose },
  wishText: { fontSize: 13, color: giftColors.ink, lineHeight: 19, fontStyle: 'italic' },
  message: { minHeight: 120, textAlignVertical: 'top', lineHeight: 21 },
  counter: { fontSize: 12, color: giftColors.muted, textAlign: 'right', marginTop: -space.sm },
  toggle: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md,
    backgroundColor: giftColors.white, borderWidth: 1, borderColor: giftColors.roseLine,
  },
  toggleIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: giftColors.rose, alignItems: 'center', justifyContent: 'center' },
  toggleTitle: { fontSize: 14, fontWeight: '700', color: giftColors.ink },
  info: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: giftColors.rose },
  infoText: { flex: 1, fontSize: 12, color: giftColors.ink, lineHeight: 17 },
  warn: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: giftColors.goldSoft },
  warnText: { flex: 1, fontSize: 12, color: giftColors.ink, lineHeight: 17 },
  error: { fontSize: 13, color: '#C0392B' },
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: giftColors.wine,
  },
  barLabel: { fontSize: 12, color: giftColors.roseLine },
  barTotal: { fontSize: 19, fontWeight: '800', color: giftColors.white, fontFamily: serif },
  barBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, minHeight: 48, borderRadius: radius.pill,
    backgroundColor: giftColors.gold,
  },
  barBtnOff: { opacity: 0.6 },
  barBtnText: { fontSize: 15, fontWeight: '800', color: giftColors.wineDark },
});
