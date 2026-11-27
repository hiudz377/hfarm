import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errMsg } from '@/api/client';
import { addToCart, removeCartItem } from '@/api/cart';
import { fetchGiftOptions, fetchGiftSuggestions } from '@/api/gifts';
import { useAuth } from '@/auth/AuthProvider';
import AddedToast from '@/components/AddedToast';
import EmptyState from '@/components/EmptyState';
import Field from '@/components/Field';
import KeyboardView from '@/components/KeyboardView';
import Loading from '@/components/Loading';
import { GiftComboCard, GiftPickCard } from '@/components/GiftItems';
import { money } from '@/utils/format';
import { giftColors, OCCASION_EMOJI, SOON_DAYS, daysLeftText, serif } from '@/utils/giftTheme';
import { setGiftDraft, useGiftDraft } from '@/utils/giftDraft';
import { loadGiftFit, saveGiftFit, validateGiftFit, validateGiftTaste } from '@/utils/giftProfile';
import { CART_KEY, useCart } from '@/utils/useCart';
import { radius, space } from '@/utils/theme';

const STEPS = [['occasion', 'Dịp'], ['size', 'Size'], ['taste', 'Gu & ngân sách'], ['result', 'Quà']];
const EMPTY = { mode: 'SIZE', top: null, bottom: null, shoe: '', height: '', weight: '', styles: [], budget: '' };
const SIZE_LETTER = /^(XS|S|M|L|XL|XXL)$/;

const HERO = {
  occasion: { emoji: '🎁', title: 'Tặng quà cho anh ấy', sub: 'Chọn dịp để bắt đầu. Chúng tôi sẽ gợi ý món đúng size, còn hàng và vừa ngân sách của bạn.' },
  size: { emoji: '📏', title: 'Anh ấy mặc size gì?', sub: 'Quà dễ sai nhất là sai size. Nhìn nhãn trong cổ áo anh ấy hay mặc là biết ngay.' },
  taste: { emoji: '💌', title: 'Gu của anh ấy và ngân sách của bạn', sub: 'Chưa rõ gu thì cứ bỏ qua, chúng tôi ưu tiên món dễ mặc, màu trung tính.' },
  result: { emoji: '✨', title: 'Quà cho anh ấy', sub: 'Chọn món bạn thích, rồi viết thiệp để gửi kèm.' },
};

function Hero({ step }) {
  const h = HERO[step];
  return (
    <View style={styles.hero}>
      <Text style={styles.heroEmoji}>{h.emoji}</Text>
      <View style={styles.heroText}>
        <Text style={styles.heroTitle}>{h.title}</Text>
        <Text style={styles.heroSub}>{h.sub}</Text>
      </View>
    </View>
  );
}

// Dải 4 bước: chấm đặc = đã tới, vàng = đang ở
function Ribbon({ step }) {
  const at = STEPS.findIndex(([key]) => key === step);
  return (
    <View style={styles.ribbon} accessibilityRole="progressbar" aria-label={`Bước ${at + 1} trên ${STEPS.length}`}>
      {STEPS.map(([key, label], i) => (
        <View key={key} style={styles.ribbonItem}>
          <View style={[styles.ribbonDot, i <= at && styles.ribbonDotOn, i === at && styles.ribbonDotNow]} />
          <Text style={[styles.ribbonText, i === at && styles.ribbonTextNow]} numberOfLines={1}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function Pill({ label, selected, onPress }) {
  return (
    <Pressable onPress={onPress} role="button" aria-pressed={selected} style={[styles.pill, selected && styles.pillOn]}>
      <Text style={[styles.pillText, selected && styles.pillTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Section({ title, hint, error, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
      {error ? <Text style={styles.error} role="alert">{error}</Text> : null}
    </View>
  );
}

function ListTitle({ title, sub }) {
  return (
    <View style={styles.listTitle}>
      <Text style={styles.listTitleText}>{title}</Text>
      {sub ? <Text style={styles.hint}>{sub}</Text> : null}
    </View>
  );
}

function PrimaryButton({ title, icon, onPress, loading, disabled }) {
  const off = loading || disabled;
  return (
    <Pressable onPress={onPress} disabled={off} role="button" style={[styles.cta, off && styles.ctaOff]}>
      <Text style={styles.ctaText}>{loading ? 'Đang tìm quà...' : title}</Text>
      {!loading && icon ? <Ionicons name={icon} size={18} color={giftColors.white} /> : null}
    </Pressable>
  );
}

function TextButton({ title, onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} role="button" style={styles.textBtn}>
      <Text style={styles.textBtnText}>{title}</Text>
    </Pressable>
  );
}

// Tặng quà: người thân (vợ, bạn gái, mẹ...) chọn dịp -> size của bạn nam -> gu + ngân sách -> nhận gợi ý quà (quà chính, combo, quà nhỏ).
// Chọn quà là thêm vào giỏ như bình thường; sau đó sang màn viết thiệp (gift-card) rồi thanh toán (checkout?gift=1).
// Công khai như Stylist: ai cũng xin gợi ý được; chọn quà (thêm vào giỏ) mới cần đăng nhập.
export default function Gift() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { status } = useAuth();
  const { data: cart } = useCart();
  const draft = useGiftDraft();

  const options = useQuery({ queryKey: ['gift-options'], queryFn: fetchGiftOptions, staleTime: 10 * 60 * 1000 });
  const [step, setStep] = useState('occasion');
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [toast, setToast] = useState(null);
  const busy = useRef(false);
  const scroller = useRef(null);
  const fade = useRef(new Animated.Value(1)).current;

  const goStep = (next) => {
    setStep(next);
    setServerError(null);
    scroller.current?.scrollTo({ y: 0, animated: false });
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  };

  // Điền sẵn size của lần trước (chỉ lưu trên máy này)
  useEffect(() => {
    let active = true;
    loadGiftFit().then((saved) => {
      if (!active || !saved) return;
      setForm((cur) => ({
        ...cur,
        mode: saved.mode === 'MEASURE' ? 'MEASURE' : 'SIZE',
        top: typeof saved.top === 'string' ? saved.top : null,
        bottom: typeof saved.bottom === 'string' && SIZE_LETTER.test(saved.bottom) ? saved.bottom : null, // bản cũ lưu số (inch): bỏ
        shoe: String(saved.shoe ?? ''),
        height: String(saved.height ?? ''),
        weight: String(saved.weight ?? ''),
      }));
    });
    return () => { active = false; };
  }, []);

  const suggest = useMutation({
    mutationFn: fetchGiftSuggestions,
    onSuccess: (data) => { setResult(data); goStep('result'); },
    onError: (e) => setServerError(errMsg(e)),
  });

  const inCart = useMemo(() => new Set((cart?.items ?? []).map((i) => i.variant_id)), [cart]);
  // Món đã chọn làm quà mà vẫn còn trong giỏ (xóa khỏi giỏ ở nơi khác thì không tính nữa)
  const picked = useMemo(() => new Set(draft.picked.filter((id) => inCart.has(id))), [draft.picked, inCart]);
  const pickedLines = (cart?.items ?? []).filter((l) => picked.has(l.variant_id));
  const pickedTotal = pickedLines.reduce((sum, l) => sum + l.price * l.quantity, 0);

  if (options.isPending) return <Loading />;
  if (options.isError) {
    return <EmptyState icon="cloud-offline-outline" title="Không tải được Quà tặng" message={errMsg(options.error)} actionLabel="Thử lại" onAction={() => options.refetch()} />;
  }
  const opts = options.data;
  const occasion = opts.occasions.find((o) => o.value === draft.occasion) ?? null;
  const set = (patch) => setForm((cur) => ({ ...cur, ...patch }));
  const clear = (key) => setErrors((e) => ({ ...e, [key]: undefined }));
  const needLogin = () => {
    Alert.alert('Cần đăng nhập', 'Hãy đăng nhập hoặc tạo tài khoản để chọn quà và đặt hàng.', [
      { text: 'Để sau', style: 'cancel' },
      { text: 'Đăng nhập', onPress: () => router.push('/login') },
    ]);
  };

  const pickOccasion = (o) => {
    setGiftDraft({ occasion: o.value, templateId: null });
    setForm((cur) => ({ ...cur, budget: cur.budget || String(o.budget_default) }));
    goStep('size');
  };

  const submitSize = () => {
    Keyboard.dismiss();
    const checked = validateGiftFit(form, opts);
    setErrors(checked.fields ?? {});
    if (checked.fit) goStep('taste');
  };

  const toggleStyle = (value) => {
    set({
      styles: form.styles.includes(value)
        ? form.styles.filter((s) => s !== value)
        : form.styles.length >= opts.max_styles ? form.styles : [...form.styles, value],
    });
  };

  const search = (override) => {
    Keyboard.dismiss();
    const data = { ...form, ...override };
    if (override) setForm(data);
    const fit = validateGiftFit(data, opts);
    if (!fit.fit) { setErrors(fit.fields); goStep('size'); return; }
    const taste = validateGiftTaste(data, opts);
    setErrors(taste.fields ?? {});
    if (!taste.budget) return;
    setServerError(null);
    saveGiftFit({ mode: data.mode, top: data.top, bottom: data.bottom, shoe: data.shoe, height: data.height, weight: data.weight });
    suggest.mutate({ occasion: draft.occasion, budget: taste.budget, styles: taste.styles, fit: fit.fit });
  };

  // Chọn / bỏ chọn một nhóm món (một món, hoặc cả combo): chọn = thêm vào giỏ, bỏ chọn = xóa khỏi giỏ.
  // Món đã có sẵn trong giỏ thì chỉ đánh dấu là quà, không thêm lần nữa (backend cộng dồn số lượng).
  const toggleItems = async (items, key) => {
    if (status !== 'authenticated') { needLogin(); return; }
    if (busy.current) return;
    busy.current = true;
    setBusyKey(key);
    const wasPicked = new Set(picked);
    const removing = items.every((i) => wasPicked.has(i.variant_id));
    let latest = null;
    let failure = null;
    const done = [];
    try {
      for (const item of items) {
        try {
          if (removing) {
            const line = (latest ?? cart)?.items.find((l) => l.variant_id === item.variant_id);
            if (line) latest = await removeCartItem(line.id);
            done.push(item);
          } else if (!wasPicked.has(item.variant_id)) {
            if (!inCart.has(item.variant_id)) latest = await addToCart({ variantId: item.variant_id, quantity: 1 });
            done.push(item);
          }
        } catch (e) {
          failure = { item, message: errMsg(e) };
          break;
        }
      }
    } finally {
      busy.current = false;
      setBusyKey(null);
    }
    const ids = done.map((i) => i.variant_id);
    setGiftDraft((d) => ({ picked: removing ? d.picked.filter((id) => !ids.includes(id)) : [...new Set([...d.picked, ...ids])] }));
    if (latest) queryClient.setQueryData(CART_KEY, latest);
    if (failure) {
      queryClient.invalidateQueries({ queryKey: CART_KEY });
      Alert.alert(`Không chọn được "${failure.item.name}"`, failure.message);
    } else if (!removing && done.length) {
      setToast({ name: items.length > 1 ? `Combo ${items.length} món` : items[0].name, image: items[0].thumbnail, at: Date.now() });
    }
  };

  const openProduct = (item) => router.push(`/product/${item.product_id}`);
  const goCard = () => {
    if (status !== 'authenticated') { needLogin(); return; }
    router.push('/gift-card');
  };

  const fit = result?.profile?.fit;
  const fitText = fit
    ? fit.mode === 'SIZE'
      ? [`Áo ${fit.top}`, fit.bottom ? `quần ${fit.bottom}` : null, fit.shoe ? `giày ${fit.shoe}` : null].filter(Boolean).join(' · ')
      : [`${fit.height_cm} cm`, `${fit.weight_kg} kg`, fit.shoe ? `giày ${fit.shoe}` : null].filter(Boolean).join(' · ')
    : '';
  const budgetNumber = Number(form.budget);
  const tabsBottom = insets.bottom + (step === 'result' && picked.size > 0 ? 96 : space.xl);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardView>
        <ScrollView ref={scroller} contentContainerStyle={[styles.scroll, { paddingBottom: tabsBottom }]} keyboardShouldPersistTaps="handled">
          <Hero step={step} />
          <Ribbon step={step} />

          <Animated.View style={[styles.body, { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
            {step === 'occasion' ? (
              <>
                <View style={styles.tiles}>
                  {opts.occasions.map((o) => {
                    const soon = o.days_left !== null && o.days_left <= SOON_DAYS;
                    return (
                      <Pressable
                        key={o.value}
                        onPress={() => pickOccasion(o)}
                        role="button"
                        aria-label={`${o.label}${o.date_text ? ` ${o.date_text}` : ''}${soon ? `, ${daysLeftText(o.days_left)}` : ''}`}
                        style={[styles.tile, soon && styles.tileSoon, draft.occasion === o.value && styles.tileOn]}
                      >
                        {soon ? <Text style={styles.soonTag}>Sắp tới</Text> : null}
                        <Text style={styles.tileEmoji}>{OCCASION_EMOJI[o.value] ?? '🎁'}</Text>
                        <Text style={styles.tileLabel}>{o.label}</Text>
                        <Text style={[styles.tileSub, soon && styles.tileSubSoon]}>
                          {soon ? `${o.date_text} · ${daysLeftText(o.days_left)}` : o.date_text ?? (o.value === 'TET' ? 'Âm lịch' : 'Ngày riêng')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable onPress={goCard} role="link" style={styles.skip}>
                  <Ionicons name="create-outline" size={18} color={giftColors.wine} />
                  <Text style={styles.skipText}>Đã chọn quà trong giỏ rồi? Viết thiệp luôn</Text>
                </Pressable>
              </>
            ) : null}

            {step === 'size' ? (
              <>
                <View style={styles.segment}>
                  {[['SIZE', 'Biết size'], ['MEASURE', 'Chỉ biết số đo']].map(([mode, label]) => (
                    <Pressable
                      key={mode}
                      onPress={() => { set({ mode }); setErrors({}); }}
                      role="button"
                      aria-pressed={form.mode === mode}
                      style={[styles.segItem, form.mode === mode && styles.segItemOn]}
                    >
                      <Text style={[styles.segText, form.mode === mode && styles.segTextOn]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>

                {form.mode === 'SIZE' ? (
                  <>
                    <Section title="Size áo anh ấy đang mặc" error={errors.top}>
                      <View style={styles.chips}>
                        {opts.sizes.letters.map((s) => (
                          <Pill key={s} label={s} selected={form.top === s} onPress={() => { set({ top: s }); clear('top'); }} />
                        ))}
                      </View>
                    </Section>
                    {/* Quần bán theo size chữ như áo. Bấm lại size đang chọn để bỏ chọn (= cùng size áo) */}
                    <Section title="Size quần" hint="Không bắt buộc. Để trống nếu bạn ấy mặc quần cùng size với áo." error={errors.bottom}>
                      <View style={styles.chips}>
                        {opts.sizes.letters.map((s) => (
                          <Pill key={s} label={s} selected={form.bottom === s} onPress={() => { set({ bottom: form.bottom === s ? null : s }); clear('bottom'); }} />
                        ))}
                      </View>
                    </Section>
                  </>
                ) : (
                  <View style={styles.pair}>
                    <View style={styles.flex}>
                      <Field label="Chiều cao (cm)" value={form.height} onChangeText={(v) => { set({ height: v }); clear('height'); }} error={errors.height} keyboardType="numeric" placeholder="173" maxLength={5} returnKeyType="next" aria-label="Chiều cao của anh ấy tính bằng cm" />
                    </View>
                    <View style={styles.flex}>
                      <Field label="Cân nặng (kg)" value={form.weight} onChangeText={(v) => { set({ weight: v }); clear('weight'); }} error={errors.weight} keyboardType="numeric" placeholder="60" maxLength={5} returnKeyType="next" aria-label="Cân nặng của anh ấy tính bằng kg" />
                    </View>
                  </View>
                )}

                <Field label="Size giày (EU)" value={form.shoe} onChangeText={(v) => { set({ shoe: v.replace(/\D/g, '') }); clear('shoe'); }} error={errors.shoe} keyboardType="number-pad" placeholder="Không bắt buộc" maxLength={2} returnKeyType="done" onSubmitEditing={submitSize} aria-label="Size giày châu Âu, không bắt buộc" />
                <View style={styles.tip}>
                  <Ionicons name="footsteps-outline" size={18} color={giftColors.wine} />
                  <Text style={styles.tipText}>Giày chỉ được gợi ý khi bạn nhập size giày chắc chắn. Không chắc thì cứ để trống, đồ khác vẫn gợi ý bình thường.</Text>
                </View>
                <Text style={styles.link} onPress={() => router.push('/size-guide')}>Xem bảng size của cửa hàng</Text>

                <PrimaryButton title="Tiếp tục" icon="arrow-forward" onPress={submitSize} />
                <TextButton title="Đổi dịp khác" onPress={() => goStep('occasion')} />
                <Text style={styles.fine}>Size chỉ dùng để chọn quà và chỉ được nhớ trên điện thoại này, không lưu trên máy chủ của cửa hàng.</Text>
              </>
            ) : null}

            {step === 'taste' ? (
              <>
                <Section title="Anh ấy hay mặc kiểu nào?" hint={`Không bắt buộc, chọn tối đa ${opts.max_styles}`}>
                  <View style={styles.chips}>
                    {opts.styles.map((s) => <Pill key={s.value} label={s.label} selected={form.styles.includes(s.value)} onPress={() => toggleStyle(s.value)} />)}
                  </View>
                </Section>

                <Section title="Ngân sách cho món quà" error={errors.budget}>
                  <Field
                    label="Số tiền (₫)"
                    value={form.budget}
                    onChangeText={(v) => { set({ budget: v.replace(/\D/g, '') }); clear('budget'); }}
                    keyboardType="number-pad"
                    placeholder="700000"
                    maxLength={9}
                    returnKeyType="done"
                    onSubmitEditing={() => search()}
                    aria-label="Ngân sách tính bằng đồng"
                  />
                  {Number.isFinite(budgetNumber) && budgetNumber > 0 ? <Text style={styles.hint}>= {money(budgetNumber)}</Text> : null}
                  <View style={styles.chips}>
                    {opts.budget.presets.map((b) => (
                      <Pill key={b} label={money(b)} selected={Number(form.budget) === b} onPress={() => { set({ budget: String(b) }); clear('budget'); }} />
                    ))}
                  </View>
                </Section>

                {serverError ? <Text style={styles.error} role="alert">{serverError}</Text> : null}
                <PrimaryButton title="Tìm quà cho anh ấy" icon="gift-outline" onPress={() => search()} loading={suggest.isPending} />
                <TextButton title="Quay lại" onPress={() => goStep('size')} />
              </>
            ) : null}

            {step === 'result' && result ? (
              <>
                <View style={styles.summary}>
                  <View style={styles.summaryTop}>
                    <Text style={styles.summaryTitle}>{occasion ? `${OCCASION_EMOJI[occasion.value] ?? ''} ${occasion.label}` : 'Quà tặng'}</Text>
                    <Pressable onPress={() => goStep('size')} hitSlop={8} role="button" aria-label="Sửa thông tin" style={styles.edit}>
                      <Ionicons name="create-outline" size={16} color={giftColors.wine} />
                      <Text style={styles.editText}>Sửa</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.summaryText}>{[fitText, money(result.profile.budget)].filter(Boolean).join(' · ')}</Text>
                  {fit?.mode === 'MEASURE' ? (
                    <Text style={styles.summaryText}>Theo số đo, size gợi ý cho áo và quần là <Text style={styles.bold}>{result.size_advice.letter}</Text>.</Text>
                  ) : null}
                  {result.notes?.map((n) => <Text key={n} style={styles.notice}>{n}</Text>)}
                </View>

                {result.empty_reason ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyEmoji}>🎁</Text>
                    {result.empty_reason === 'BUDGET_TOO_LOW' ? (
                      <>
                        <Text style={styles.emptyTitle}>Ngân sách chưa đủ cho món nào</Text>
                        <Text style={styles.emptyText}>Với {money(result.profile.budget)}, món rẻ nhất còn đúng size khoảng {money(result.min_budget)}.</Text>
                        <PrimaryButton
                          title={`Thử với ${money(Math.ceil(result.min_budget / 10000) * 10000)}`}
                          onPress={() => search({ budget: String(Math.ceil(result.min_budget / 10000) * 10000) })}
                          loading={suggest.isPending}
                        />
                      </>
                    ) : (
                      <>
                        <Text style={styles.emptyTitle}>Chưa có món nào hợp</Text>
                        <Text style={styles.emptyText}>Cửa hàng chưa có sản phẩm còn hàng đúng size này. Hãy thử đổi size hoặc xem cửa hàng.</Text>
                        <TextButton title="Đổi size" onPress={() => goStep('size')} />
                      </>
                    )}
                  </View>
                ) : null}

                {result.main.length ? (
                  <>
                    <ListTitle title="Quà chính" sub="Một món đáng nhớ, đúng size anh ấy" />
                    {result.main.map((item) => (
                      <GiftPickCard
                        key={item.variant_id}
                        item={item}
                        picked={picked.has(item.variant_id)}
                        busy={busyKey === `one:${item.variant_id}`}
                        onToggle={() => toggleItems([item], `one:${item.variant_id}`)}
                        onOpen={() => openProduct(item)}
                      />
                    ))}
                  </>
                ) : null}

                {result.combos.length ? (
                  <>
                    <ListTitle title="Combo quà" sub="Ghép sẵn hai ba món cho trọn bộ" />
                    {result.combos.map((combo, i) => (
                      <GiftComboCard
                        key={combo.items.map((x) => x.variant_id).join('-')}
                        combo={combo}
                        index={i}
                        pickedSet={picked}
                        busy={busyKey === `combo:${i}`}
                        onToggle={() => toggleItems(combo.items, `combo:${i}`)}
                        onOpen={openProduct}
                      />
                    ))}
                  </>
                ) : null}

                {result.small.length ? (
                  <>
                    <ListTitle title="Quà nhỏ kèm theo" sub="Thêm cho trọn bộ quà" />
                    {result.small.map((item) => (
                      <GiftPickCard
                        key={item.variant_id}
                        item={item}
                        picked={picked.has(item.variant_id)}
                        busy={busyKey === `one:${item.variant_id}`}
                        onToggle={() => toggleItems([item], `one:${item.variant_id}`)}
                        onOpen={() => openProduct(item)}
                      />
                    ))}
                  </>
                ) : null}

                <Text style={styles.fine}>Giá chưa gồm phí giao hàng. Gợi ý dựa trên sản phẩm đang bán và còn hàng tại thời điểm này.</Text>
              </>
            ) : null}
          </Animated.View>
        </ScrollView>
      </KeyboardView>

      {step === 'result' && picked.size > 0 ? (
        <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
          <View style={styles.flex}>
            <Text style={styles.barLabel}>Đã chọn {pickedLines.length} món</Text>
            <Text style={styles.barTotal}>{money(pickedTotal)}</Text>
          </View>
          <Pressable onPress={goCard} role="button" style={styles.barBtn}>
            <Text style={styles.barBtnText}>Viết thiệp</Text>
            <Ionicons name="arrow-forward" size={18} color={giftColors.wineDark} />
          </Pressable>
        </View>
      ) : null}

      <AddedToast
        toast={toast}
        bottom={insets.bottom + (picked.size > 0 ? 96 : space.lg)}
        onClose={() => setToast(null)}
        onView={() => { setToast(null); router.push('/gift-card'); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: giftColors.cream },
  scroll: { gap: space.lg },
  flex: { flex: 1 },
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, paddingTop: space.md, paddingBottom: space.xl,
    backgroundColor: giftColors.wine, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl,
  },
  heroEmoji: { fontSize: 40 },
  heroText: { flex: 1, gap: 4 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: giftColors.white, fontFamily: serif, lineHeight: 28 },
  heroSub: { fontSize: 13, color: giftColors.roseLine, lineHeight: 18 },
  ribbon: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg },
  ribbonItem: { flex: 1, alignItems: 'center', gap: 6 },
  ribbonDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: giftColors.roseLine },
  ribbonDotOn: { backgroundColor: giftColors.wine },
  ribbonDotNow: { backgroundColor: giftColors.gold, transform: [{ scale: 1.4 }] },
  ribbonText: { fontSize: 11, color: giftColors.muted },
  ribbonTextNow: { color: giftColors.wine, fontWeight: '800' },
  body: { paddingHorizontal: space.lg, gap: space.lg },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: {
    width: '47.5%', flexGrow: 1, alignItems: 'center', gap: 4, paddingVertical: space.lg, paddingHorizontal: space.sm,
    borderRadius: radius.lg, backgroundColor: giftColors.white, borderWidth: 1, borderColor: giftColors.roseLine,
  },
  tileSoon: { borderColor: giftColors.gold, borderWidth: 2, backgroundColor: giftColors.goldSoft },
  tileOn: { borderColor: giftColors.wine, borderWidth: 2 },
  soonTag: {
    position: 'absolute', top: -10, alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 2, borderRadius: radius.pill,
    backgroundColor: giftColors.gold, color: giftColors.white, fontSize: 11, fontWeight: '800', overflow: 'hidden',
  },
  tileEmoji: { fontSize: 34 },
  tileLabel: { fontSize: 15, fontWeight: '800', color: giftColors.ink, fontFamily: serif, textAlign: 'center' },
  tileSub: { fontSize: 12, color: giftColors.muted },
  tileSubSoon: { color: giftColors.wineDark, fontWeight: '800' },
  skip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: space.md, borderRadius: radius.md,
    borderWidth: 1, borderStyle: 'dashed', borderColor: giftColors.wine,
  },
  skipText: { fontSize: 13, fontWeight: '700', color: giftColors.wine },
  segment: { flexDirection: 'row', padding: 4, borderRadius: radius.pill, backgroundColor: giftColors.rose },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.pill },
  segItemOn: { backgroundColor: giftColors.wine },
  segText: { fontSize: 14, fontWeight: '700', color: giftColors.wine },
  segTextOn: { color: giftColors.white },
  section: { gap: space.sm },
  label: { fontSize: 15, fontWeight: '800', color: giftColors.ink, fontFamily: serif },
  hint: { fontSize: 12, color: giftColors.muted },
  error: { fontSize: 12, color: '#C0392B' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pair: { flexDirection: 'row', gap: space.md },
  pill: {
    minHeight: 40, minWidth: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: radius.pill,
    backgroundColor: giftColors.white, borderWidth: 1, borderColor: giftColors.roseLine,
  },
  pillOn: { backgroundColor: giftColors.wine, borderColor: giftColors.wine },
  pillText: { fontSize: 14, fontWeight: '600', color: giftColors.ink },
  pillTextOn: { color: giftColors.white, fontWeight: '800' },
  tip: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: giftColors.rose },
  tipText: { flex: 1, fontSize: 12, color: giftColors.ink, lineHeight: 17 },
  link: { fontSize: 13, fontWeight: '700', color: giftColors.wine, textDecorationLine: 'underline' },
  cta: {
    minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20,
    borderRadius: radius.pill, backgroundColor: giftColors.wine,
  },
  ctaOff: { opacity: 0.55 },
  ctaText: { fontSize: 16, fontWeight: '800', color: giftColors.white, letterSpacing: 0.2 },
  textBtn: { alignItems: 'center', paddingVertical: 6 },
  textBtnText: { fontSize: 14, fontWeight: '700', color: giftColors.muted },
  fine: { fontSize: 12, color: giftColors.muted, textAlign: 'center', lineHeight: 17 },
  summary: { padding: space.lg, gap: space.sm, borderRadius: radius.lg, backgroundColor: giftColors.white, borderWidth: 1, borderColor: giftColors.roseLine },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: giftColors.ink, fontFamily: serif },
  edit: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  editText: { fontSize: 13, fontWeight: '800', color: giftColors.wine },
  summaryText: { fontSize: 13, color: giftColors.muted, lineHeight: 18 },
  bold: { fontWeight: '800', color: giftColors.wine },
  notice: { fontSize: 12, color: giftColors.ink, backgroundColor: giftColors.goldSoft, borderRadius: radius.md, padding: space.md, lineHeight: 17, overflow: 'hidden' },
  listTitle: { gap: 2, marginTop: space.sm },
  listTitleText: { fontSize: 20, fontWeight: '800', color: giftColors.wine, fontFamily: serif },
  empty: { padding: space.xl, alignItems: 'center', gap: space.md, borderRadius: radius.lg, backgroundColor: giftColors.white, borderWidth: 1, borderColor: giftColors.roseLine },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: giftColors.ink, textAlign: 'center', fontFamily: serif },
  emptyText: { fontSize: 14, color: giftColors.muted, textAlign: 'center', lineHeight: 20 },
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: giftColors.wine,
  },
  barLabel: { fontSize: 12, color: giftColors.roseLine },
  barTotal: { fontSize: 19, fontWeight: '800', color: giftColors.white, fontFamily: serif },
  barBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, minHeight: 48, borderRadius: radius.pill,
    backgroundColor: giftColors.gold,
  },
  barBtnText: { fontSize: 15, fontWeight: '800', color: giftColors.wineDark },
});
