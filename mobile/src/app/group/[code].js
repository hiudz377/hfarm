import { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errMsg } from '@/api/client';
import { addToCart } from '@/api/cart';
import { cancelGroup, changeGroupVariant, fetchGroup, joinGroup, leaveGroup } from '@/api/groups';
import { fetchProduct } from '@/api/products';
import { useAuth } from '@/auth/AuthProvider';
import Button from '@/components/Button';
import Card from '@/components/Card';
import EmptyState from '@/components/EmptyState';
import Loading from '@/components/Loading';
import Photo from '@/components/Photo';
import VariantPicker from '@/components/VariantPicker';
import { money } from '@/utils/format';
import { durationText, groupPrice, inviteMessage, normalizeGroupCode, prettyCode, tierText } from '@/utils/groupBuy';
import { goBack, goToTab } from '@/utils/nav';
import { CART_KEY, groupKey, MY_GROUPS_KEY } from '@/utils/queryKeys';
import { useCart } from '@/utils/useCart';
import { useCountdown } from '@/utils/useCountdown';
import { colors, radius, space } from '@/utils/theme';

// Thanh tiến độ: bao nhiêu người so với sức chứa, kèm các bậc giá (bậc đã đạt được tô xanh)
function TierLadder({ tiers, count, price, activePercent }) {
  return (
    <View style={styles.ladder}>
      {tiers.map((t) => {
        const reached = count >= t.min_members;
        const active = activePercent != null && Number(activePercent) === Number(t.discount_percent);
        return (
          <View key={t.min_members} style={[styles.tier, reached && styles.tierOn, active && styles.tierActive]}>
            <Ionicons name={reached ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={reached ? colors.primary : colors.muted} />
            <Text style={[styles.tierText, reached && styles.tierTextOn]}>{tierText(t)}</Text>
            {price != null ? <Text style={[styles.tierPrice, reached && styles.tierTextOn]}>{money(groupPrice(price, t.discount_percent))}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

// Nhóm mua nhóm: xem tiến độ, mời bạn, tham gia (chọn size/màu), rời / hủy, và mua theo giá nhóm khi nhóm đã chốt thành công.
// Xem công khai (người được mời xem trước khi đăng nhập); các thao tác cần đăng nhập. Không thu tiền lúc tham gia.
export default function GroupScreen() {
  const { code: rawCode } = useLocalSearchParams();
  const code = normalizeGroupCode(Array.isArray(rawCode) ? rawCode[0] : rawCode);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { status } = useAuth();
  const signedIn = status === 'authenticated';
  const { data: cart } = useCart();

  const group = useQuery({
    queryKey: groupKey(code ?? 'invalid'),
    queryFn: () => fetchGroup(code),
    enabled: !!code,
    // Nhóm đang mở thì tự cập nhật (có người vào / hết hạn); đã đóng thì thôi
    refetchInterval: (query) => (query.state.data?.status === 'OPEN' ? 15000 : false),
  });
  const g = group.data;
  const product = useQuery({ queryKey: ['product', String(g?.product.id ?? 0)], queryFn: () => fetchProduct(g.product.id), enabled: !!g, staleTime: 60 * 1000 });

  const [pickedVariant, setPickedVariant] = useState(null);
  const [changing, setChanging] = useState(false);
  const [copied, setCopied] = useState(false);
  const left = useCountdown(g?.status === 'OPEN' ? g.seconds_left : null, group.dataUpdatedAt);
  const claimLeft = useCountdown(g?.status === 'SUCCESS' ? g.claim_seconds_left : null, group.dataUpdatedAt);

  const apply = (next) => {
    queryClient.setQueryData(groupKey(next.code), next);
    queryClient.invalidateQueries({ queryKey: MY_GROUPS_KEY });
  };
  const fail = (title) => (e) => Alert.alert(title, errMsg(e));
  const join = useMutation({ mutationFn: joinGroup, onSuccess: (d) => { apply(d); setPickedVariant(null); }, onError: fail('Không tham gia được') });
  const change = useMutation({ mutationFn: changeGroupVariant, onSuccess: (d) => { apply(d); setChanging(false); setPickedVariant(null); }, onError: fail('Không đổi được size/màu') });
  const leave = useMutation({ mutationFn: leaveGroup, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['groups'] }); }, onError: fail('Không rời được nhóm') });
  const cancel = useMutation({ mutationFn: cancelGroup, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['groups'] }); }, onError: fail('Không hủy được nhóm') });
  const buy = useMutation({
    mutationFn: addToCart,
    onSuccess: (newCart) => { queryClient.setQueryData(CART_KEY, newCart); goToTab(router, '/cart'); },
    onError: fail('Không thêm được vào giỏ'),
  });

  if (!code) {
    return <EmptyState icon="people-outline" title="Mã nhóm không đúng" message="Mã nhóm gồm 8 ký tự chữ và số. Hãy kiểm tra lại link hoặc mã bạn nhận được." actionLabel="Nhập mã khác" onAction={() => router.replace('/groups')} />;
  }
  if (group.isPending) return <Loading />;
  if (group.isError) {
    if (group.error?.response?.status === 404) {
      return <EmptyState icon="people-outline" title="Không tìm thấy nhóm" message="Nhóm không tồn tại hoặc mã chưa đúng." actionLabel="Nhập mã khác" onAction={() => router.replace('/groups')} />;
    }
    return <EmptyState icon="cloud-offline-outline" title="Không tải được nhóm" message={errMsg(group.error)} actionLabel="Thử lại" onAction={() => group.refetch()} />;
  }

  const me = g.me;
  const open = g.status === 'OPEN';
  const variants = product.data?.variants ?? [];
  const chosen = variants.find((v) => v.id === pickedVariant) ?? null;
  const busy = join.isPending || change.isPending || leave.isPending || cancel.isPending || buy.isPending;
  const inCart = me ? !!cart?.items.some((i) => i.variant_id === me.variant.id) : false;

  const onShare = async () => {
    try {
      await Share.share({ message: inviteMessage(g) });
    } catch {
      // đóng hộp chia sẻ hoặc thiết bị không hỗ trợ: bỏ qua (vẫn sao chép mã được)
    }
  };
  const onCopy = async () => {
    try {
      await Clipboard.setStringAsync(g.share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // không ghi được clipboard: bỏ qua
    }
  };
  const confirm = (title, message, okText, run) =>
    Alert.alert(title, message, [{ text: 'Không', style: 'cancel' }, { text: okText, style: 'destructive', onPress: run }]);
  const needLogin = () =>
    Alert.alert('Cần đăng nhập', 'Hãy đăng nhập hoặc tạo tài khoản để tham gia nhóm.', [
      { text: 'Để sau', style: 'cancel' },
      { text: 'Đăng nhập', onPress: () => router.push('/login') },
    ]);

  // Giá minh họa theo mẫu mã đang xem: của mình (đã tham gia) hoặc mẫu mã đang chọn
  const refPrice = me ? me.variant.price : chosen?.price ?? g.product.price_from;
  const nowPercent = g.active_percent;

  const banner = (() => {
    if (open) {
      return {
        icon: 'people',
        title: `Đang mở: ${g.member_count}/${g.capacity} người`,
        sub: `Còn ${durationText(left ?? g.seconds_left)} để rủ thêm bạn`,
      };
    }
    if (g.status === 'SUCCESS') return { icon: 'checkmark-circle', title: 'Nhóm đã chốt thành công', sub: `${g.final_members} người, mỗi người giảm ${g.final_percent}%` };
    if (g.status === 'FAILED') return { icon: 'time-outline', title: 'Nhóm chưa đủ người', sub: `Hết hạn mà chưa đủ ${g.tiers[0].min_members} người nên không có giảm giá` };
    return { icon: 'close-circle-outline', title: 'Nhóm đã bị hủy', sub: 'Chủ nhóm đã hủy nhóm này' };
  })();
  const hint = open
    ? (g.next_tier
      ? `${g.current_tier ? 'Thêm' : 'Cần thêm'} ${g.members_to_next} người nữa để mỗi người giảm ${g.next_tier.discount_percent}%`
      : `Đã đạt mức giảm cao nhất ${g.current_tier.discount_percent}%`)
    : null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space.xl }]}>
        <Pressable onPress={() => router.push(`/product/${g.product.id}`)} role="link" aria-label={`Xem sản phẩm ${g.product.name}`}>
          <Card style={styles.productCard}>
            <Photo uri={g.product.thumbnail} style={styles.photo} whole />
            <View style={styles.productText}>
              <Text style={styles.label}>MUA NHÓM</Text>
              <Text style={styles.name} numberOfLines={3}>{g.product.name}</Text>
              <Text style={styles.muted}>Giá thường từ {money(g.product.price_from)}</Text>
            </View>
          </Card>
        </Pressable>

        <Card style={[styles.banner, g.status === 'SUCCESS' && styles.bannerOk]}>
          <View style={styles.bannerHead}>
            <Ionicons name={banner.icon} size={26} color={g.status === 'SUCCESS' || open ? colors.primary : colors.muted} />
            <View style={styles.flex}>
              <Text style={styles.bannerTitle}>{banner.title}</Text>
              <Text style={styles.muted}>{banner.sub}</Text>
            </View>
          </View>
          {open ? (
            <View style={styles.track} accessible role="progressbar" aria-label={`${g.member_count} trên ${g.capacity} người`}>
              <View style={[styles.fill, { width: `${Math.min((g.member_count / g.capacity) * 100, 100)}%` }]} />
            </View>
          ) : null}
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          <TierLadder tiers={g.tiers} count={open ? g.member_count : (g.final_members ?? 0)} price={refPrice} activePercent={nowPercent} />
          {open && nowPercent != null ? (
            <Text style={styles.priceNow}>Giá nhóm hiện tại: <Text style={styles.priceBold}>{money(groupPrice(refPrice, nowPercent))}</Text> ({nowPercent}% so với giá thường {money(refPrice)})</Text>
          ) : null}
        </Card>

        <Card style={styles.members}>
          <Text style={styles.sectionTitle}>Thành viên ({g.member_count})</Text>
          {g.members.map((m, i) => (
            <View key={`${m.name}-${i}`} style={styles.member}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{String(m.name).trim().charAt(0).toUpperCase()}</Text></View>
              <Text style={styles.memberName}>{m.name}</Text>
              {m.is_leader ? <Text style={styles.tag}>Chủ nhóm</Text> : null}
              {m.is_me ? <Text style={[styles.tag, styles.tagMe]}>Bạn</Text> : null}
            </View>
          ))}
        </Card>

        {/* ---- Hành động ---- */}
        {!signedIn ? (
          <Card style={styles.actions}>
            <Text style={styles.muted}>{open ? 'Đăng nhập để tham gia nhóm. Bạn chọn size, màu khi tham gia và chỉ trả tiền khi nhóm chốt thành công.' : 'Đăng nhập để xem tình trạng của bạn trong nhóm.'}</Text>
            <Button title="Đăng nhập" onPress={() => router.push('/login')} />
          </Card>
        ) : null}

        {signedIn && !me && open ? (
          <Card style={styles.actions}>
            <Text style={styles.sectionTitle}>Tham gia nhóm</Text>
            <Text style={styles.muted}>Chọn size và màu bạn muốn. Chưa phải trả tiền: chỉ trả khi nhóm chốt thành công và bạn bấm mua.</Text>
            {product.isPending ? <Loading /> : <VariantPicker variants={variants} value={pickedVariant} onChange={setPickedVariant} />}
            {chosen ? <Text style={styles.priceNow}>Giá thường {money(chosen.price)}{nowPercent != null ? `, giá nhóm hiện tại ${money(groupPrice(chosen.price, nowPercent))}` : ''}</Text> : null}
            <Button
              title={chosen && Number(chosen.stock) <= 0 ? 'Mẫu mã đã hết hàng' : 'Tham gia nhóm'}
              icon="people-outline"
              disabled={!chosen || Number(chosen.stock) <= 0}
              loading={join.isPending}
              onPress={() => join.mutate({ code: g.code, variantId: pickedVariant })}
            />
            {!chosen ? <Text style={styles.hintSmall}>Hãy chọn đủ màu và size.</Text> : null}
          </Card>
        ) : null}

        {signedIn && !me && !open ? (
          <Card style={styles.actions}>
            <Text style={styles.muted}>Nhóm đã đóng nên không thể tham gia. Bạn có thể tự tạo nhóm của mình ở trang sản phẩm.</Text>
            <Button title="Xem sản phẩm" variant="outline" onPress={() => router.push(`/product/${g.product.id}`)} />
          </Card>
        ) : null}

        {me ? (
          <Card style={styles.actions}>
            <Text style={styles.sectionTitle}>Của bạn</Text>
            <View style={styles.mine}>
              <Ionicons name="shirt-outline" size={20} color={colors.primary} />
              <Text style={styles.mineText}>Size {me.variant.size_name} · {me.variant.color_name}</Text>
              {Number(me.variant.stock) <= 0 ? <Text style={styles.warn}>Hết hàng</Text> : null}
            </View>
            {me.price_now != null ? (
              <Text style={styles.priceNow}>Giá nhóm của bạn: <Text style={styles.priceBold}>{money(me.price_now)}</Text> (giảm {money(me.discount_now)})</Text>
            ) : (
              <Text style={styles.priceNow}>Giá thường {money(me.variant.price)}. Đủ {g.tiers[0].min_members} người bạn sẽ được giảm.</Text>
            )}

            {open ? (
              <>
                <Button title="Mời bạn bè" icon="share-social-outline" onPress={onShare} />
                <Pressable onPress={onCopy} style={styles.linkRow} role="button" aria-label="Sao chép link mời">
                  <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={colors.primary} />
                  <Text style={styles.linkText}>{copied ? 'Đã sao chép link' : `Sao chép link · mã ${prettyCode(g.share.code)}`}</Text>
                </Pressable>
              </>
            ) : null}

            {g.status === 'SUCCESS' && me.claim === 'CAN_CLAIM' ? (
              <>
                <Text style={styles.claimLeft}>Bạn còn {durationText(claimLeft ?? g.claim_seconds_left)} để mua theo giá nhóm</Text>
                <Button
                  title={Number(me.variant.stock) <= 0 ? 'Đổi size/màu còn hàng để mua' : `Mua với giá nhóm ${money(me.price_now)}`}
                  icon="bag-handle-outline"
                  disabled={Number(me.variant.stock) <= 0}
                  loading={buy.isPending}
                  onPress={() => (inCart ? goToTab(router, '/cart') : buy.mutate({ variantId: me.variant.id, quantity: 1 }))}
                />
                {inCart ? <Text style={styles.hintSmall}>Sản phẩm đã có trong giỏ: vào giỏ hàng và thanh toán, giá nhóm tự áp dụng.</Text> : null}
              </>
            ) : null}
            {me.claim === 'CLAIMED' ? (
              <>
                <Text style={styles.claimLeft}>Bạn đã mua theo giá nhóm.</Text>
                {me.order_id ? <Button title="Xem đơn hàng" variant="outline" onPress={() => router.push(`/order/${me.order_id}`)} /> : null}
              </>
            ) : null}
            {me.claim === 'EXPIRED' ? <Text style={styles.warn}>Đã hết hạn mua theo giá nhóm. Bạn vẫn mua được với giá thường.</Text> : null}
            {g.status === 'FAILED' || g.status === 'CANCELLED' ? (
              <Button title="Xem sản phẩm" variant="outline" onPress={() => router.push(`/product/${g.product.id}`)} />
            ) : null}

            {(open || me.claim === 'CAN_CLAIM') ? (
              <>
                <Pressable onPress={() => { setChanging((v) => !v); setPickedVariant(me.variant.id); }} style={styles.linkRow} role="button" aria-label="Đổi size hoặc màu">
                  <Ionicons name="swap-horizontal-outline" size={16} color={colors.primary} />
                  <Text style={styles.linkText}>{changing ? 'Đóng' : 'Đổi size / màu'}</Text>
                </Pressable>
                {changing ? (
                  <View style={styles.change}>
                    <VariantPicker variants={variants} value={pickedVariant} onChange={setPickedVariant} />
                    <Button
                      title="Lưu size / màu"
                      variant="soft"
                      disabled={!chosen || chosen.id === me.variant.id || Number(chosen.stock) <= 0}
                      loading={change.isPending}
                      onPress={() => change.mutate({ code: g.code, variantId: pickedVariant })}
                    />
                  </View>
                ) : null}
              </>
            ) : null}

            {open && !me.is_leader ? (
              <Button title="Rời nhóm" variant="danger" disabled={busy} onPress={() => confirm('Rời nhóm?', 'Bạn sẽ không còn trong nhóm và không được giá nhóm nếu không vào lại.', 'Rời nhóm', () => leave.mutate(g.code))} />
            ) : null}
            {open && me.is_leader ? (
              <Button title="Hủy nhóm" variant="danger" disabled={busy} onPress={() => confirm('Hủy nhóm?', 'Mọi thành viên sẽ không còn nhóm này. Không hoàn tác được.', 'Hủy nhóm', () => cancel.mutate(g.code))} />
            ) : null}
          </Card>
        ) : null}

        <Text style={styles.fine}>Mua nhóm: đủ số người ở mỗi bậc thì mọi người trong nhóm được giảm theo bậc cao nhất đạt được. Hết hạn hoặc đủ người thì nhóm chốt; sau đó bạn có {g.status === 'SUCCESS' ? 'thời hạn ghi ở trên' : 'một khoảng thời gian'} để mua với giá nhóm. Không thu tiền khi tham gia.</Text>
        <Pressable onPress={() => goBack(router, '/')} role="button" style={styles.back}><Text style={styles.linkText}>Về trang trước</Text></Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: space.lg, gap: space.lg },
  productCard: { flexDirection: 'row', gap: space.md, padding: space.md, alignItems: 'center' },
  photo: { width: 76, height: 96, borderRadius: radius.sm },
  productText: { flex: 1, gap: 3 },
  label: { fontSize: 11, fontWeight: '800', color: colors.primary, letterSpacing: 1 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text, lineHeight: 21 },
  muted: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  banner: { padding: space.lg, gap: space.md },
  bannerOk: { backgroundColor: colors.primarySoft },
  bannerHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  bannerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 10, backgroundColor: colors.primary, borderRadius: 5 },
  hint: { fontSize: 14, fontWeight: '700', color: colors.primaryDark },
  ladder: { gap: 6 },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tierOn: { borderColor: colors.primary + '66' },
  tierActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  tierText: { flex: 1, fontSize: 14, color: colors.muted },
  tierTextOn: { color: colors.text, fontWeight: '700' },
  tierPrice: { fontSize: 14, color: colors.muted },
  priceNow: { fontSize: 14, color: colors.text, lineHeight: 20 },
  priceBold: { fontWeight: '800', color: colors.primary },
  members: { padding: space.lg, gap: space.sm },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  member: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 4 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800', color: colors.primaryDark },
  memberName: { fontSize: 14, color: colors.text, flexShrink: 1 },
  tag: { fontSize: 11, fontWeight: '800', color: colors.primaryDark, backgroundColor: colors.primarySoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },
  tagMe: { backgroundColor: colors.primary, color: colors.white },
  actions: { padding: space.lg, gap: space.md },
  mine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mineText: { fontSize: 15, fontWeight: '600', color: colors.text },
  warn: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  claimLeft: { fontSize: 14, fontWeight: '700', color: colors.primaryDark },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  linkText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  change: { gap: space.md },
  hintSmall: { fontSize: 12, color: colors.muted },
  fine: { fontSize: 12, color: colors.muted, lineHeight: 17, textAlign: 'center' },
  back: { alignSelf: 'center', paddingVertical: 4 },
});
