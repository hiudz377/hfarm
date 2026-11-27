import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errMsg } from '@/api/client';
import { addToCart } from '@/api/cart';
import { fetchOutfits, fetchStylistOptions } from '@/api/stylist';
import { useAuth } from '@/auth/AuthProvider';
import AddedToast from '@/components/AddedToast';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Chip from '@/components/Chip';
import EmptyState from '@/components/EmptyState';
import Field from '@/components/Field';
import KeyboardView from '@/components/KeyboardView';
import Loading from '@/components/Loading';
import OutfitCard from '@/components/OutfitCard';
import { money } from '@/utils/format';
import { goToTab } from '@/utils/nav';
import { loadStylistProfile, saveStylistProfile, validateStylistForm } from '@/utils/stylistProfile';
import { CART_KEY, useCart } from '@/utils/useCart';
import { colors, radius, space } from '@/utils/theme';

const BUDGET_PRESETS = [500000, 700000, 1000000, 1500000, 2000000];
// Cửa hàng chỉ bán đồ nam nên không hỏi giới tính
const EMPTY_FORM = { height: '', weight: '', styles: [], occasion: null, budget: '' };

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

// Stylist cá nhân: khách nhập giới tính, số đo, phong cách, hoàn cảnh, ngân sách -> backend ghép các bộ đồ từ sản phẩm đang bán
// (đúng size, còn hàng, không vượt ngân sách). Mua cả bộ hoặc từng món đều đi qua giỏ hàng như bình thường.
export default function Stylist() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { status } = useAuth();
  const { data: cart } = useCart();

  const options = useQuery({ queryKey: ['stylist-options'], queryFn: fetchStylistOptions, staleTime: 60 * 60 * 1000 });
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [adding, setAdding] = useState(null); // 'all:<key bộ>' | 'one:<mã mẫu mã>' đang thêm vào giỏ
  const [toast, setToast] = useState(null);
  const busy = useRef(false);

  // Điền sẵn thông tin lần trước (nếu có)
  useEffect(() => {
    let active = true;
    loadStylistProfile().then((saved) => {
      if (!active || !saved) return;
      setForm(() => ({
        height: String(saved.height ?? ''),
        weight: String(saved.weight ?? ''),
        styles: Array.isArray(saved.styles) ? saved.styles : [],
        occasion: typeof saved.occasion === 'string' ? saved.occasion : null,
        budget: String(saved.budget ?? ''),
      }));
    });
    return () => { active = false; };
  }, []);

  const suggest = useMutation({
    mutationFn: fetchOutfits,
    onSuccess: setResult,
    onError: (e) => setServerError(errMsg(e)),
  });

  const inCart = useMemo(() => new Set((cart?.items ?? []).map((i) => i.variant_id)), [cart]);
  const labelOf = (list, value) => list?.find((o) => o.value === value)?.label ?? value;

  if (options.isPending) return <Loading />;
  if (options.isError) {
    return <EmptyState icon="cloud-offline-outline" title="Không tải được Stylist" message={errMsg(options.error)} actionLabel="Thử lại" onAction={() => options.refetch()} />;
  }
  const opts = options.data;
  const set = (patch) => setForm((cur) => ({ ...cur, ...patch }));

  const toggleStyle = (value) => {
    setErrors((e) => ({ ...e, styles: undefined }));
    set({
      styles: form.styles.includes(value)
        ? form.styles.filter((s) => s !== value)
        : form.styles.length >= opts.max_styles ? form.styles : [...form.styles, value],
    });
  };

  const submit = (override) => {
    Keyboard.dismiss();
    const data = { ...form, ...override };
    if (override) setForm(data);
    const checked = validateStylistForm(data, opts);
    setErrors(checked.fields ?? {});
    if (!checked.profile) return;
    setServerError(null);
    saveStylistProfile(data);
    suggest.mutate(checked.profile);
  };

  // Thêm các món vào giỏ lần lượt (backend cộng dồn nếu đã có nên món đã trong giỏ được bỏ qua: bấm lại không nhân đôi)
  const addItems = async (items, scope, toastName) => {
    if (status !== 'authenticated') {
      Alert.alert('Cần đăng nhập', 'Hãy đăng nhập hoặc tạo tài khoản để thêm sản phẩm vào giỏ hàng.', [
        { text: 'Để sau', style: 'cancel' },
        { text: 'Đăng nhập', onPress: () => router.push('/login') },
      ]);
      return;
    }
    const todo = items.filter((i) => !inCart.has(i.variant_id));
    if (!todo.length || busy.current) return;
    busy.current = true;
    setAdding(scope);
    let latest = null;
    let done = 0;
    let failure = null;
    try {
      for (const item of todo) {
        try {
          latest = await addToCart({ variantId: item.variant_id, quantity: 1 });
          done += 1;
        } catch (e) {
          failure = { item, message: errMsg(e) };
          break;
        }
      }
    } finally {
      busy.current = false;
      setAdding(null);
    }
    if (latest) queryClient.setQueryData(CART_KEY, latest);
    if (failure) {
      queryClient.invalidateQueries({ queryKey: CART_KEY }); // lỗi giữa chừng: không chắc giỏ đang ra sao nên tải lại
      Alert.alert(`Không thêm được "${failure.item.name}"`, `${failure.message}${done ? `\nĐã thêm ${done} món trước đó vào giỏ.` : ''}`);
    } else if (done) {
      setToast({ name: toastName ?? todo[0].name, image: todo[0].thumbnail, at: Date.now() });
    }
  };

  const openProduct = (item) => router.push(`/product/${item.product_id}`);

  // ---- Kết quả ----
  if (result) {
    const p = result.profile;
    const hasShoes = result.outfits.some((o) => o.items.some((i) => i.role === 'SHOES'));
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}>
          <Card style={styles.summary}>
            <View style={styles.summaryTop}>
              <Ionicons name="sparkles" size={20} color={colors.primary} />
              <Text style={styles.summaryTitle}>Gợi ý cho bạn</Text>
              <Pressable onPress={() => { setResult(null); setServerError(null); }} hitSlop={8} role="button" aria-label="Sửa thông tin" style={styles.edit}>
                <Ionicons name="create-outline" size={16} color={colors.primary} />
                <Text style={styles.editText}>Sửa thông tin</Text>
              </Pressable>
            </View>
            <Text style={styles.summaryText}>
              {[`${p.height_cm} cm`, `${p.weight_kg} kg`, p.styles.map((s) => labelOf(opts.styles, s)).join(' / '), labelOf(opts.occasions, p.occasion), money(p.budget)].join(' · ')}
            </Text>
            <Text style={styles.sizeText}>
              Size gợi ý: áo, quần <Text style={styles.bold}>{result.size_advice.letter}</Text>
              {hasShoes ? <Text>, giày khoảng <Text style={styles.bold}>{result.size_advice.shoe}</Text> (ước lượng theo chiều cao, hãy kiểm tra lại)</Text> : null}
              .{' '}
              <Text style={styles.link} onPress={() => router.push('/size-guide')}>Xem bảng size</Text>
            </Text>
            {result.notes?.map((n) => <Text key={n} style={styles.notice}>{n}</Text>)}
          </Card>

          {result.outfits.length === 0 ? (
            <Card style={styles.empty}>
              <Ionicons name="shirt-outline" size={34} color={colors.primary} />
              {result.empty_reason === 'BUDGET_TOO_LOW' ? (
                <>
                  <Text style={styles.emptyTitle}>Ngân sách chưa đủ cho một bộ hoàn chỉnh</Text>
                  <Text style={styles.emptyText}>
                    Với {money(p.budget)}, chưa ghép được áo + quần phù hợp. Bộ rẻ nhất hiện có khoảng {money(result.min_budget)}.
                  </Text>
                  <Button title={`Thử với ${money(Math.ceil(result.min_budget / 10000) * 10000)}`} onPress={() => submit({ budget: String(Math.ceil(result.min_budget / 10000) * 10000) })} loading={suggest.isPending} />
                </>
              ) : (
                <>
                  <Text style={styles.emptyTitle}>Chưa đủ sản phẩm để phối bộ này</Text>
                  <Text style={styles.emptyText}>
                    Cửa hàng chưa có {(result.missing_roles ?? []).map((m) => m.role_label.toLowerCase()).join(', ') || 'sản phẩm'} phù hợp với số đo, giới tính và lựa chọn của bạn. Hãy thử đổi phong cách hoặc hoàn cảnh, hoặc xem cửa hàng.
                  </Text>
                  <Button title="Xem cửa hàng" variant="outline" onPress={() => goToTab(router, '/shop')} />
                </>
              )}
            </Card>
          ) : (
            result.outfits.map((o) => (
              <OutfitCard
                key={o.key}
                outfit={o}
                inCart={inCart}
                addingKey={adding}
                onAddAll={() => addItems(o.items, `all:${o.key}`, `Cả bộ ${o.items.length} món`)}
                onAddOne={(item) => addItems([item], `one:${item.variant_id}`, item.name)}
                onOpen={openProduct}
              />
            ))
          )}
          <Text style={styles.fine}>Giá chưa gồm phí giao hàng. Gợi ý dựa trên sản phẩm đang bán và còn hàng tại thời điểm này.</Text>
        </ScrollView>

        <AddedToast
          toast={toast}
          bottom={insets.bottom + space.lg}
          onClose={() => setToast(null)}
          onView={() => { setToast(null); goToTab(router, '/cart'); }}
        />
      </View>
    );
  }

  // ---- Form ----
  const budgetNumber = Number(form.budget);
  return (
    <KeyboardView>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="sparkles" size={22} color={colors.primary} /></View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>Hôm nay mặc gì?</Text>
            <Text style={styles.heroSub}>Cho chúng tôi biết số đo, phong cách và ngân sách. Stylist sẽ phối sẵn cả bộ từ sản phẩm đang có tại cửa hàng.</Text>
          </View>
        </View>

        <View style={styles.pair}>
          <View style={styles.flex}>
            <Field label="Chiều cao (cm)" value={form.height} onChangeText={(v) => { set({ height: v }); setErrors((e) => ({ ...e, height: undefined })); }} error={errors.height} keyboardType="numeric" placeholder="173" maxLength={5} returnKeyType="next" aria-label="Chiều cao tính bằng cm" />
          </View>
          <View style={styles.flex}>
            <Field label="Cân nặng (kg)" value={form.weight} onChangeText={(v) => { set({ weight: v }); setErrors((e) => ({ ...e, weight: undefined })); }} error={errors.weight} keyboardType="numeric" placeholder="60" maxLength={5} returnKeyType="done" aria-label="Cân nặng tính bằng kg" />
          </View>
        </View>

        <Section title="Phong cách yêu thích" hint={`Chọn tối đa ${opts.max_styles}`} error={errors.styles}>
          <View style={styles.chips}>
            {opts.styles.map((s) => <Chip key={s.value} label={s.label} selected={form.styles.includes(s.value)} onPress={() => toggleStyle(s.value)} />)}
          </View>
        </Section>

        <Section title="Bạn mặc đi đâu?" error={errors.occasion}>
          <View style={styles.chips}>
            {opts.occasions.map((o) => (
              <Chip key={o.value} label={o.label} selected={form.occasion === o.value} onPress={() => { set({ occasion: o.value }); setErrors((e) => ({ ...e, occasion: undefined })); }} />
            ))}
          </View>
        </Section>

        <Section title="Ngân sách cho cả bộ" error={errors.budget}>
          <Field
            label="Số tiền (₫)"
            value={form.budget}
            onChangeText={(v) => { set({ budget: v.replace(/\D/g, '') }); setErrors((e) => ({ ...e, budget: undefined })); }}
            keyboardType="number-pad"
            placeholder="700000"
            maxLength={9}
            returnKeyType="done"
            onSubmitEditing={() => submit()}
            aria-label="Ngân sách tính bằng đồng"
          />
          {Number.isFinite(budgetNumber) && budgetNumber > 0 ? <Text style={styles.hint}>= {money(budgetNumber)}</Text> : null}
          <View style={styles.chips}>
            {BUDGET_PRESETS.map((b) => (
              <Chip key={b} label={money(b)} selected={Number(form.budget) === b} onPress={() => { set({ budget: String(b) }); setErrors((e) => ({ ...e, budget: undefined })); }} />
            ))}
          </View>
        </Section>

        {serverError ? <Text style={styles.error} role="alert">{serverError}</Text> : null}
        <Button title="Gợi ý bộ đồ cho tôi" icon="sparkles-outline" onPress={() => submit()} loading={suggest.isPending} />
        <Text style={styles.fine}>Chiều cao, cân nặng chỉ dùng để chọn size và không được lưu lại trên máy chủ của cửa hàng.</Text>
      </ScrollView>
    </KeyboardView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { padding: space.lg, gap: space.lg },
  flex: { flex: 1 },
  hero: { flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.primarySoft },
  heroIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  heroText: { flex: 1, gap: 4 },
  heroTitle: { fontSize: 20, fontWeight: '800', color: colors.primaryDark },
  heroSub: { fontSize: 13, color: colors.primaryDark, lineHeight: 18 },
  section: { gap: space.sm },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  hint: { fontSize: 12, color: colors.muted },
  error: { fontSize: 12, color: colors.danger },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pair: { flexDirection: 'row', gap: space.md },
  fine: { fontSize: 12, color: colors.muted, textAlign: 'center', lineHeight: 17 },
  summary: { padding: space.lg, gap: space.sm },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.text },
  edit: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  editText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  summaryText: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  sizeText: { fontSize: 13, color: colors.text, lineHeight: 19 },
  bold: { fontWeight: '800', color: colors.primary },
  link: { color: colors.primary, fontWeight: '700' },
  notice: { fontSize: 12, color: colors.text, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: space.md, lineHeight: 17, overflow: 'hidden' },
  empty: { padding: space.xl, alignItems: 'center', gap: space.md },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.text, textAlign: 'center' },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
});
