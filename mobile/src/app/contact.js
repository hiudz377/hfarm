import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BrandLogo from '@/components/BrandLogo';
import Card from '@/components/Card';
import ContactActions from '@/components/ContactActions';
import MenuRow from '@/components/MenuRow';
import { usePullRefresh } from '@/utils/useRefresh';
import { useStore } from '@/utils/useStore';
import { colors, space } from '@/utils/theme';

const InfoLine = ({ icon, text }) => (
  <View style={styles.line}>
    <Ionicons name={icon} size={18} color={colors.primary} />
    <Text style={styles.lineText} selectable>{text}</Text>
  </View>
);

// Liên hệ cửa hàng + lối vào các chính sách. Xem được cả khi chưa đăng nhập.
export default function Contact() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { store, refetch } = useStore();
  const { refreshing, onRefresh } = usePullRefresh(refetch);

  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, { paddingBottom: space.xl + insets.bottom }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
    >
      <Card style={styles.head}>
        <BrandLogo variant="compact" width={130} />
        <Text style={styles.title}>{store.name}</Text>
        {store.address ? <InfoLine icon="location-outline" text={store.address} /> : null}
        {store.hours ? <InfoLine icon="time-outline" text={store.hours} /> : null}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.h}>Liên hệ với chúng tôi</Text>
        <Text style={styles.sub}>Cần tư vấn size, đổi trả hoặc hỏi về đơn hàng? Chọn cách liên hệ thuận tiện nhất.</Text>
        <ContactActions />
      </Card>

      <Card clip>
        <MenuRow icon="swap-horizontal-outline" title="Chính sách đổi trả" subtitle={`Đổi size, trả hàng trong ${store.return_days} ngày`} onPress={() => router.push('/policy/returns')} />
        <MenuRow icon="resize-outline" title="Hướng dẫn chọn size" subtitle="Bảng size và gợi ý theo số đo" onPress={() => router.push('/size-guide')} />
        <MenuRow icon="shield-checkmark-outline" title="Chính sách bảo mật" subtitle="Chúng tôi dùng thông tin của bạn thế nào" onPress={() => router.push('/policy/privacy')} />
        <MenuRow icon="document-text-outline" title="Điều khoản sử dụng" onPress={() => router.push('/policy/terms')} last />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, gap: space.lg },
  head: { padding: space.lg, gap: space.sm, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  line: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', alignSelf: 'stretch', justifyContent: 'center' },
  lineText: { flexShrink: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
  card: { padding: space.md, gap: space.sm },
  h: { fontSize: 15, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, lineHeight: 18 },
});
