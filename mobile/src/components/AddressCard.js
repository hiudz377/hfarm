import { Pressable, StyleSheet, Text, View } from 'react-native';
import Card from './Card';
import { colors, space } from '@/utils/theme';

export const fullAddress = (a) => [a.address_detail, a.ward, a.district, a.province].filter(Boolean).join(', ');

// Thẻ địa chỉ trong Sổ địa chỉ: các nút Đặt mặc định / Sửa / Xóa. busy: khóa nút khi đang gọi API.
export default function AddressCard({ address, busy, onSetDefault, onEdit, onDelete }) {
  const isDefault = !!address.is_default;
  return (
    <Card style={[styles.card, isDefault && styles.cardDefault]}>
      <View style={styles.head}>
        <Text style={styles.name} numberOfLines={1}>{address.recipient_name} · {address.phone}</Text>
        {isDefault ? <Text style={styles.tag}>Mặc định</Text> : null}
      </View>
      <Text style={styles.addr}>{fullAddress(address)}</Text>
      <View style={styles.actions}>
        {!isDefault ? (
          <Pressable onPress={onSetDefault} disabled={busy} hitSlop={8} style={busy && styles.off}>
            <Text style={styles.link}>Đặt mặc định</Text>
          </Pressable>
        ) : <View />}
        <View style={styles.right}>
          <Pressable onPress={onEdit} disabled={busy} hitSlop={8} style={busy && styles.off}>
            <Text style={styles.link}>Sửa</Text>
          </Pressable>
          <Pressable onPress={onDelete} disabled={busy} hitSlop={8} style={busy && styles.off}>
            <Text style={styles.danger}>Xóa</Text>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.md, gap: space.sm },
  cardDefault: { borderColor: colors.primary },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  tag: { fontSize: 11, color: colors.primary, fontWeight: '700', borderWidth: 1, borderColor: colors.primary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  addr: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xs },
  right: { flexDirection: 'row', gap: space.lg },
  link: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  danger: { fontSize: 14, color: colors.danger, fontWeight: '600' },
  off: { opacity: 0.4 },
});
