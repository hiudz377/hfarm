import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { errMsg } from '@/api/client';
import { fetchAuthConfig, registerAccount } from '@/api/auth';
import { useAuth } from '@/auth/AuthProvider';
import { authErrorMessage } from '@/auth/keycloak';
import Button from '@/components/Button';
import Field from '@/components/Field';
import KeyboardView from '@/components/KeyboardView';
import { useMounted } from '@/utils/useMounted';
import { validateSignIn, validateSignUp } from '@/utils/validate';
import { colors, radius, space } from '@/utils/theme';

// Đăng nhập / tạo tài khoản NGAY TRONG APP bằng email + mật khẩu (không mở trang Keycloak trong trình duyệt).
// Đăng ký đi qua backend (POST /auth/register); sau đó tự đăng nhập. Chỉ khi backend chưa cấu hình đăng ký trong app,
// hoặc client chưa bật đăng nhập bằng mật khẩu, mới có nút dự phòng mở trang Keycloak.
export default function LoginForm({ initialMode = 'in', dismissLabel, onDismiss }) {
  const { signInWithPassword, signIn, signUp, sessionExpired } = useAuth();
  const mounted = useMounted();
  const config = useQuery({ queryKey: ['auth-config'], queryFn: fetchAuthConfig, staleTime: 5 * 60 * 1000 });
  const canRegister = config.data?.registration === true;

  const [mode, setMode] = useState(initialMode === 'up' ? 'up' : 'in');
  const [values, setValues] = useState({ fullName: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [browserFallback, setBrowserFallback] = useState(false); // client chưa bật đăng nhập bằng mật khẩu -> cho phép dùng trình duyệt
  const submitting = useRef(false); // chống bấm đúp trong cùng nhịp
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  const set = (key) => (text) => {
    setValues((v) => ({ ...v, [key]: text }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const switchMode = (next) => {
    if (busy) return;
    setMode(next);
    setErrors({});
    setFormError(null);
  };

  const finish = () => {
    submitting.current = false;
    if (mounted.current) setBusy(false);
  };

  const submitSignIn = async () => {
    if (submitting.current) return;
    const found = validateSignIn(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    submitting.current = true;
    setBusy(true);
    setFormError(null);
    try {
      await signInWithPassword({ email: values.email, password: values.password });
      // Thành công: AuthProvider đổi trạng thái, màn này tự đóng / tab tự hiện nội dung
    } catch (e) {
      if (mounted.current) {
        setFormError(authErrorMessage(e));
        setBrowserFallback(e?.kind === 'config');
      }
    } finally {
      finish();
    }
  };

  const submitSignUp = async () => {
    if (submitting.current) return;
    const found = validateSignUp(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    submitting.current = true;
    setBusy(true);
    setFormError(null);
    try {
      await registerAccount({ fullName: values.fullName.trim(), email: values.email.trim(), password: values.password });
    } catch (e) {
      if (mounted.current) setFormError(errMsg(e)); // 409 đã đăng ký, 400 mật khẩu yếu, 429, 503...
      finish();
      return;
    }
    try {
      await signInWithPassword({ email: values.email, password: values.password });
    } catch (e) {
      // Đã tạo xong tài khoản nhưng chưa đăng nhập được (ví dụ realm bắt xác minh email): chuyển sang tab Đăng nhập
      if (mounted.current) {
        setMode('in');
        setValues((v) => ({ ...v, password: '', confirm: '' }));
        setFormError(`Tài khoản đã được tạo nhưng chưa đăng nhập được. ${authErrorMessage(e)}`);
        setBrowserFallback(e?.kind === 'config');
      }
    } finally {
      finish();
    }
  };

  const toggleEye = (
    <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={8} role="button" aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} style={styles.eye}>
      <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
    </Pressable>
  );

  const signInForm = (
    <View style={styles.form}>
      <Field
        label="Email"
        value={values.email}
        onChangeText={set('email')}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        placeholder="ten@example.com"
        aria-label="Email"
      />
      <Field
        ref={passwordRef}
        label="Mật khẩu"
        value={values.password}
        onChangeText={set('password')}
        error={errors.password}
        secureTextEntry={!showPw}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submitSignIn}
        right={toggleEye}
        aria-label="Mật khẩu"
      />
      <Button title="Đăng nhập" loading={busy} onPress={submitSignIn} />
      <Pressable onPress={() => signIn().catch((e) => setFormError(authErrorMessage(e)))} hitSlop={8} style={styles.linkWrap} role="button">
        <Text style={styles.link}>Quên mật khẩu?</Text>
      </Pressable>
    </View>
  );

  const signUpForm = (
    <View style={styles.form}>
      <Field
        label="Họ và tên"
        value={values.fullName}
        onChangeText={set('fullName')}
        error={errors.fullName}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        placeholder="Nguyễn Văn A"
        aria-label="Họ và tên"
      />
      <Field
        ref={emailRef}
        label="Email"
        value={values.email}
        onChangeText={set('email')}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        placeholder="ten@example.com"
        aria-label="Email"
      />
      <Field
        ref={passwordRef}
        label="Mật khẩu"
        value={values.password}
        onChangeText={set('password')}
        error={errors.password}
        secureTextEntry={!showPw}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        right={toggleEye}
        placeholder="Tối thiểu 8 ký tự"
        aria-label="Mật khẩu"
      />
      <Field
        ref={confirmRef}
        label="Nhập lại mật khẩu"
        value={values.confirm}
        onChangeText={set('confirm')}
        error={errors.confirm}
        secureTextEntry={!showPw}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submitSignUp}
        aria-label="Nhập lại mật khẩu"
      />
      <Button title="Tạo tài khoản" loading={busy} onPress={submitSignUp} />
    </View>
  );

  let body;
  if (mode === 'in') body = signInForm;
  else if (config.isPending) body = <ActivityIndicator color={colors.primary} style={styles.loading} />;
  else if (canRegister) body = signUpForm;
  else {
    body = (
      <View style={styles.form}>
        <Text style={styles.note}>Tạo tài khoản mới sẽ mở trang đăng ký trong trình duyệt.</Text>
        <Button title="Tạo tài khoản bằng trình duyệt" variant="outline" onPress={() => signUp().catch((e) => setFormError(authErrorMessage(e)))} />
      </View>
    );
  }

  return (
    <KeyboardView>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.box}>
          <View style={styles.logo}>
            <Ionicons name="leaf" size={36} color={colors.white} />
          </View>
          <Text style={styles.brand}>HFarm</Text>

          <View style={styles.tabs} role="tablist">
            {[['in', 'Đăng nhập'], ['up', 'Đăng ký']].map(([key, label]) => (
              <Pressable key={key} onPress={() => switchMode(key)} role="tab" aria-selected={mode === key} style={[styles.tab, mode === key && styles.tabOn]}>
                <Text style={[styles.tabText, mode === key && styles.tabTextOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {sessionExpired ? <Text style={styles.expired}>Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.</Text> : null}
          {formError ? <Text style={styles.error} role="alert">{formError}</Text> : null}

          {body}

          {browserFallback ? (
            <Button
              title="Đăng nhập bằng trình duyệt"
              variant="outline"
              onPress={() => signIn().catch((e) => setFormError(authErrorMessage(e)))}
              style={styles.fallback}
            />
          ) : null}

          {onDismiss ? (
            <Pressable onPress={onDismiss} hitSlop={8} style={styles.dismiss}>
              <Text style={styles.dismissText}>{dismissLabel || 'Để sau'}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space.xl },
  box: { alignSelf: 'center', width: '100%', maxWidth: 380, gap: space.md },
  logo: { alignSelf: 'center', width: 68, height: 68, borderRadius: 34, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  brand: { alignSelf: 'center', fontSize: 26, fontWeight: '800', color: colors.primaryDark, marginBottom: space.xs },
  tabs: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: radius.md, padding: 3 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md - 2 },
  tabOn: { backgroundColor: colors.surface },
  tabText: { fontSize: 15, fontWeight: '600', color: colors.muted },
  tabTextOn: { color: colors.primaryDark },
  form: { gap: space.md },
  loading: { paddingVertical: space.xl },
  note: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  eye: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  linkWrap: { alignSelf: 'center' },
  link: { fontSize: 14, color: colors.primary },
  expired: { fontSize: 13, color: colors.primaryDark, backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, textAlign: 'center', overflow: 'hidden' },
  error: { fontSize: 13, color: colors.danger, backgroundColor: '#FDECEA', borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, lineHeight: 18, overflow: 'hidden' },
  fallback: { marginTop: space.xs },
  dismiss: { alignSelf: 'center', marginTop: space.sm },
  dismissText: { fontSize: 14, color: colors.muted, textDecorationLine: 'underline' },
});
