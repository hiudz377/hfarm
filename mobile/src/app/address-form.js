import { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errMsg } from '@/api/client';
import { createAddress, fetchAddresses, updateAddress } from '@/api/addresses';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import Field from '@/components/Field';
import KeyboardView from '@/components/KeyboardView';
import Loading from '@/components/Loading';
import { goBack } from '@/utils/nav';
import { useMounted } from '@/utils/useMounted';
import { ADDRESSES_KEY } from '@/utils/queryKeys';
import { cleanAddress, validateAddress } from '@/utils/validate';
import { colors, space } from '@/utils/theme';

const EMPTY = { recipient_name: '', phone: '', province: '', district: '', ward: '', address_detail: '' };

// Thêm địa chỉ mới, hoặc sửa địa chỉ khi có ?id=.
//   ?from=checkout : mở từ Thanh toán -> xong quay lại Thanh toán và chọn luôn địa chỉ vừa tạo
//   (không có from): mở từ Sổ địa chỉ -> xong chỉ quay lại
export default function AddressFormScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const editing = id != null && id !== '';
  const q = useQuery({ queryKey: ADDRESSES_KEY, queryFn: fetchAddresses });

  let content;
  if (!editing) {
    content = <AddressForm addresses={q.data} />;
  } else if (q.isPending) {
    // Đang sửa: cần dữ liệu địa chỉ trước khi dựng form (state ban đầu của form lấy từ đây)
    content = <Loading />;
  } else if (q.isError && !q.data) {
    content = <EmptyState icon="cloud-offline-outline" title="Không tải được địa chỉ" message={errMsg(q.error)} actionLabel="Thử lại" onAction={() => q.refetch()} />;
  } else {
    const address = q.data.find((a) => String(a.id) === String(id));
    content = address ? (
      <AddressForm key={address.id} addresses={q.data} address={address} />
    ) : (
      <EmptyState icon="location-outline" title="Không tìm thấy địa chỉ" message="Địa chỉ này có thể đã bị xóa." actionLabel="Quay lại" onAction={() => goBack(router, '/addresses')} />
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: editing ? 'Sửa địa chỉ' : 'Thêm địa chỉ mới' }} />
      {content}
    </>
  );
}

function AddressForm({ addresses, address }) {
  const { from } = useLocalSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const editing = !!address;

  const [values, setValues] = useState(
    address
      ? {
          recipient_name: address.recipient_name ?? '',
          phone: address.phone ?? '',
          province: address.province ?? '',
          district: address.district ?? '',
          ward: address.ward ?? '',
          address_detail: address.address_detail ?? '',
        }
      : EMPTY,
  );
  const [errors, setErrors] = useState({});
  const [isDefault, setIsDefault] = useState(false);
  const submitting = useRef(false); // khóa ngay trong cùng nhịp bấm (state cập nhật chậm hơn một nhịp)
  const mounted = useMounted();

  // Địa chỉ đầu tiên của người dùng luôn là mặc định (backend tự đặt); địa chỉ đang mặc định thì không bỏ mặc định ở đây
  // (hãy đặt địa chỉ khác làm mặc định)
  const isFirst = !editing && addresses ? addresses.length === 0 : false;
  const alreadyDefault = editing && !!address.is_default;
  const switchOn = isFirst || alreadyDefault || isDefault;

  const save = useMutation({
    mutationFn: (payload) => (editing ? updateAddress({ id: address.id, ...payload }) : createAddress(payload)),
    onSuccess: async (res) => {
      // Tải lại danh sách TRƯỚC khi quay về, để màn trước có sẵn dữ liệu mới
      await queryClient.invalidateQueries({ queryKey: ADDRESSES_KEY });
      if (!mounted.current) return; // người dùng đã thoát màn này trong lúc chờ: không điều hướng thêm (sẽ lùi nhầm một màn)
      if (from === 'checkout' && !editing) {
        router.dismissTo({ pathname: '/checkout', params: { newAddressId: String(res.id) } });
      } else {
        goBack(router, '/addresses');
      }
    },
    onError: (e) => Alert.alert('Không lưu được địa chỉ', errMsg(e)),
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
    const found = validateAddress(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    submitting.current = true;
    const payload = cleanAddress(values);
    if (!alreadyDefault) payload.is_default = isFirst || isDefault;
    save.mutate(payload);
  };

  const refs = { phone: useRef(null), province: useRef(null), district: useRef(null), ward: useRef(null), address_detail: useRef(null) };

  return (
    <KeyboardView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {Object.keys(errors).some((k) => errors[k]) ? (
          <Text style={styles.summary}>Vui lòng kiểm tra lại các ô được đánh dấu đỏ.</Text>
        ) : null}

        <Field label="Họ tên người nhận" value={values.recipient_name} onChangeText={set('recipient_name')} error={errors.recipient_name}
          placeholder="Nguyễn Văn A" autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => refs.phone.current?.focus()} maxLength={150} />
        <Field ref={refs.phone} label="Số điện thoại" value={values.phone} onChangeText={set('phone')} error={errors.phone}
          placeholder="0912345678" keyboardType="phone-pad" returnKeyType="next" onSubmitEditing={() => refs.province.current?.focus()} maxLength={16} />
        <Field ref={refs.province} label="Tỉnh / Thành phố" value={values.province} onChangeText={set('province')} error={errors.province}
          placeholder="TP. Hồ Chí Minh" returnKeyType="next" onSubmitEditing={() => refs.district.current?.focus()} maxLength={100} />
        <Field ref={refs.district} label="Quận / Huyện" value={values.district} onChangeText={set('district')} error={errors.district}
          placeholder="Quận 1" returnKeyType="next" onSubmitEditing={() => refs.ward.current?.focus()} maxLength={100} />
        <Field ref={refs.ward} label="Phường / Xã" value={values.ward} onChangeText={set('ward')} error={errors.ward}
          placeholder="Phường Bến Nghé" returnKeyType="next" onSubmitEditing={() => refs.address_detail.current?.focus()} maxLength={100} />
        <Field ref={refs.address_detail} label="Địa chỉ chi tiết (số nhà, đường)" value={values.address_detail} onChangeText={set('address_detail')}
          error={errors.address_detail} placeholder="12 Nguyễn Huệ" returnKeyType="done" onSubmitEditing={submit} maxLength={255} />

        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchTitle}>Đặt làm địa chỉ mặc định</Text>
            {isFirst ? <Text style={styles.hint}>Địa chỉ đầu tiên luôn là mặc định.</Text> : null}
            {alreadyDefault ? <Text style={styles.hint}>Đây là địa chỉ mặc định. Muốn đổi, hãy đặt địa chỉ khác làm mặc định.</Text> : null}
          </View>
          <Switch
            value={switchOn}
            onValueChange={setIsDefault}
            disabled={isFirst || alreadyDefault}
            trackColor={{ true: colors.primary }}
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Button title={editing ? 'Lưu thay đổi' : 'Lưu địa chỉ'} loading={save.isPending} onPress={submit} />
      </View>
    </KeyboardView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  scroll: { padding: space.lg, gap: space.lg, paddingBottom: space.xl },
  summary: { color: colors.danger, fontSize: 13 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  switchText: { flex: 1, gap: 2 },
  switchTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  hint: { fontSize: 12, color: colors.muted },
  footer: { padding: space.lg, paddingTop: space.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
});
