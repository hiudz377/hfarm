import { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errMsg } from '@/api/client';
import { fetchMe, updateMe } from '@/api/me';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import Field from '@/components/Field';
import KeyboardView from '@/components/KeyboardView';
import Loading from '@/components/Loading';
import { goBack } from '@/utils/nav';
import { useMounted } from '@/utils/useMounted';
import { ME_KEY } from '@/utils/queryKeys';
import { cleanProfile, validateProfile } from '@/utils/validate';
import { colors, space } from '@/utils/theme';

// Sửa họ tên + số điện thoại (PUT /me). Email chỉ xem (đến từ tài khoản đăng nhập).
export default function Profile() {
  const me = useQuery({ queryKey: ME_KEY, queryFn: fetchMe });
  if (me.isPending) return <Loading />;
  if (me.isError && !me.data) {
    return <EmptyState icon="cloud-offline-outline" title="Không tải được thông tin" message={errMsg(me.error)} actionLabel="Thử lại" onAction={() => me.refetch()} />;
  }
  return <ProfileForm user={me.data} />;
}

function ProfileForm({ user }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  // Khởi tạo một lần từ dữ liệu đã tải (ProfileForm chỉ mount khi đã có dữ liệu)
  const [values, setValues] = useState({ full_name: user.full_name ?? '', phone: user.phone ?? '' });
  const [errors, setErrors] = useState({});
  const submitting = useRef(false);
  const mounted = useMounted();
  const phoneRef = useRef(null);

  const dirty =
    cleanProfile(values).full_name !== (user.full_name ?? '') || (cleanProfile(values).phone ?? '') !== (user.phone ?? '');

  const save = useMutation({
    mutationFn: updateMe,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ME_KEY });
      if (!mounted.current) return; // đã thoát màn này: không hiện hộp thoại / lùi thêm một màn
      Alert.alert('Đã lưu', 'Thông tin cá nhân đã được cập nhật.');
      goBack(router, '/account');
    },
    onError: (e) => Alert.alert('Không lưu được', errMsg(e)),
    onSettled: () => {
      submitting.current = false;
    },
  });

  const set = (key) => (text) => {
    setValues((v) => ({ ...v, [key]: text }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = () => {
    if (submitting.current || save.isPending) return;
    const found = validateProfile(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    submitting.current = true;
    save.mutate(cleanProfile(values));
  };

  return (
    <KeyboardView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.readonly}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.email} selectable>{user.email}</Text>
        </View>
        <Field label="Họ tên" value={values.full_name} onChangeText={set('full_name')} error={errors.full_name} placeholder="Nguyễn Văn A"
          autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => phoneRef.current?.focus()} maxLength={150} />
        <Field ref={phoneRef} label="Số điện thoại (không bắt buộc)" value={values.phone} onChangeText={set('phone')} error={errors.phone}
          placeholder="0912345678" keyboardType="phone-pad" returnKeyType="done" onSubmitEditing={submit} maxLength={16} />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Button title="Lưu thay đổi" loading={save.isPending} disabled={!dirty} onPress={submit} />
      </View>
    </KeyboardView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  scroll: { padding: space.lg, gap: space.lg },
  readonly: { gap: 4 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  email: { fontSize: 15, color: colors.muted },
  footer: { padding: space.lg, paddingTop: space.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
});
