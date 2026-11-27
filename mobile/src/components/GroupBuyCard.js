import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from './Button';
import Card from './Card';
import { money } from '@/utils/format';
import { groupPrice, tierText } from '@/utils/groupBuy';
import { colors, radius, space } from '@/utils/theme';

// Thẻ "Mua nhóm" ở trang sản phẩm: các bậc giá (tính theo mẫu mã đang chọn, chưa chọn thì theo giá thấp nhất), nút tạo nhóm,
// lối vào nhập mã nhóm. groupBuy: { hours, tiers: [{ min_members, discount_percent }] } từ GET /products/:id.
const hoursText = (h) => (h % 24 === 0 ? `${h / 24} ngày` : `${h} giờ`);

export default function GroupBuyCard({ groupBuy, price, exact, onCreate, creating, onEnterCode }) {
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.icon}><Ionicons name="people" size={20} color={colors.primary} /></View>
        <View style={styles.flex}>
          <Text style={styles.title}>Mua nhóm, càng đông càng rẻ</Text>
          <Text style={styles.sub}>Tạo nhóm, gửi link cho bạn bè. Đủ người thì mỗi người được giảm.</Text>
        </View>
      </View>

      <View style={styles.tiers}>
        {groupBuy.tiers.map((t) => (
          <View key={t.min_members} style={styles.tier}>
            <Text style={styles.tierText}>{tierText(t)}</Text>
            <Text style={styles.tierPrice}>{exact ? '' : 'từ '}{money(groupPrice(price, t.discount_percent))}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.note}>
        Bạn có {hoursText(groupBuy.hours)} để rủ thêm người. Chưa phải trả tiền: chỉ trả khi nhóm chốt thành công và bạn bấm mua.
      </Text>
      <Button title="Tạo nhóm mua chung" icon="people-outline" variant="soft" loading={creating} onPress={onCreate} />
      <Pressable onPress={onEnterCode} hitSlop={8} role="link" aria-label="Nhập mã nhóm" style={styles.codeRow}>
        <Text style={styles.codeText}>Đã có mã nhóm của bạn bè? Nhập mã</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.md },
  flex: { flex: 1 },
  head: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  tiers: { gap: 6 },
  tier: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md, paddingVertical: 9, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  tierText: { fontSize: 14, fontWeight: '600', color: colors.primaryDark },
  tierPrice: { fontSize: 15, fontWeight: '800', color: colors.primary },
  note: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  codeRow: { alignSelf: 'center' },
  codeText: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
