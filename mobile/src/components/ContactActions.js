import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Button from '@/components/Button';
import { callStore, emailStore, zaloStore } from '@/utils/contact';
import { useStore } from '@/utils/useStore';
import { colors, space } from '@/utils/theme';

// Các nút liên hệ cửa hàng (Gọi / Zalo / Email). Chỉ hiện kênh nào cửa hàng đã cấu hình ở backend (STORE_PHONE, STORE_ZALO,
// STORE_EMAIL). orderCode: điền sẵn mã đơn vào thư gửi cửa hàng.
export default function ContactActions({ orderCode }) {
  const { store, loaded, isPending, isError, refetch } = useStore();

  if (isPending) return <ActivityIndicator color={colors.primary} style={styles.loading} />;
  if (isError) {
    return (
      <View style={styles.box}>
        <Text style={styles.note}>Không tải được thông tin liên hệ. Kiểm tra kết nối mạng rồi thử lại.</Text>
        <Button title="Thử lại" variant="outline" onPress={() => refetch()} />
      </View>
    );
  }

  const hasAny = loaded && (store.phone || store.zalo || store.email);
  if (!hasAny) {
    return (
      <Text style={styles.note}>
        Cửa hàng chưa cập nhật thông tin liên hệ trong ứng dụng.
        {__DEV__ ? ' [dev] Đặt STORE_PHONE / STORE_ZALO / STORE_EMAIL trong backend/.env rồi khởi động lại backend.' : ''}
      </Text>
    );
  }

  return (
    <View style={styles.row}>
      {store.phone ? <Button title="Gọi điện" icon="call-outline" style={styles.btn} onPress={() => callStore(store.phone)} /> : null}
      {store.zalo ? <Button title="Nhắn Zalo" icon="chatbubble-ellipses-outline" variant="outline" style={styles.btn} onPress={() => zaloStore(store.zalo)} /> : null}
      {store.email ? (
        <Button title="Gửi email" icon="mail-outline" variant="outline" style={styles.btn} onPress={() => emailStore(store.email, { storeName: store.name, orderCode })} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.sm },
  loading: { paddingVertical: space.md },
  note: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  // Hai nút một hàng; nút lẻ cuối hàng tự giãn hết chiều ngang
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  btn: { flexGrow: 1, flexBasis: '45%', paddingHorizontal: space.md },
});
