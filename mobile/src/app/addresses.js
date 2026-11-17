import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errMsg } from '@/api/client';
import { deleteAddress, fetchAddresses, updateAddress } from '@/api/addresses';
import AddressCard, { fullAddress } from '@/components/AddressCard';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import Loading from '@/components/Loading';
import { ADDRESSES_KEY } from '@/utils/queryKeys';
import { usePullRefresh } from '@/utils/useRefresh';
import { colors, space } from '@/utils/theme';

// Sổ địa chỉ: thêm / sửa / xóa / đặt mặc định
export default function Addresses() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const q = useQuery({ queryKey: ADDRESSES_KEY, queryFn: fetchAddresses });
  const addresses = q.data ?? [];
  const { refreshing, onRefresh } = usePullRefresh(q.refetch);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ADDRESSES_KEY });
  const onError = (title) => (e) => {
    Alert.alert(title, errMsg(e));
    refresh(); // dữ liệu có thể đã lệch: tải lại
  };

  const setDefault = useMutation({
    mutationKey: ['address-mutate'],
    mutationFn: (id) => updateAddress({ id, is_default: true }),
    onSuccess: refresh,
    onError: onError('Không đặt được địa chỉ mặc định'),
  });
  const remove = useMutation({
    mutationKey: ['address-mutate'],
    mutationFn: async ({ address, others }) => {
      await deleteAddress(address.id);
      // Backend không tự chọn địa chỉ mặc định khác: xóa địa chỉ mặc định thì chuyển mặc định sang địa chỉ mới nhất còn lại.
      // Bước này lỗi thì địa chỉ ĐÃ bị xóa: không báo "không xóa được" mà báo riêng (xem onSuccess).
      if (address.is_default && others.length) {
        try {
          await updateAddress({ id: others[0].id, is_default: true });
        } catch {
          return { promoteFailed: true };
        }
      }
      return { promoteFailed: false };
    },
    onSuccess: (res) => {
      refresh();
      if (res?.promoteFailed) {
        Alert.alert('Đã xóa địa chỉ', 'Chưa đặt được địa chỉ mặc định mới. Hãy chọn một địa chỉ và bấm "Đặt mặc định".');
      }
    },
    onError: onError('Không xóa được địa chỉ'),
  });
  const busy = useIsMutating({ mutationKey: ['address-mutate'] }) > 0;

  const confirmDelete = (address) =>
    Alert.alert('Xóa địa chỉ?', `${address.recipient_name} · ${address.phone}\n${fullAddress(address)}`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => remove.mutate({ address, others: addresses.filter((a) => a.id !== address.id) }),
      },
    ]);

  const add = () => router.push('/address-form');

  if (q.isPending) return <Loading />;
  if (q.isError && !q.data) {
    return <EmptyState icon="cloud-offline-outline" title="Không tải được địa chỉ" message={errMsg(q.error)} actionLabel="Thử lại" onAction={() => q.refetch()} />;
  }
  if (!addresses.length) {
    return (
      <EmptyState icon="location-outline" title="Chưa có địa chỉ nào" message="Thêm địa chỉ để đặt hàng nhanh hơn." actionLabel="Thêm địa chỉ" onAction={add} />
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={addresses}
        keyExtractor={(a) => String(a.id)}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        refreshing={refreshing}
        onRefresh={onRefresh}
        renderItem={({ item }) => (
          <AddressCard
            address={item}
            busy={busy}
            onSetDefault={() => setDefault.mutate(item.id)}
            onEdit={() => router.push({ pathname: '/address-form', params: { id: String(item.id) } })}
            onDelete={() => confirmDelete(item)}
          />
        )}
      />
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Button title="+ Thêm địa chỉ mới" onPress={add} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.lg },
  footer: { padding: space.lg, paddingTop: space.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
});
