import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '@/components/Card';
import ContactActions from '@/components/ContactActions';
import EmptyState from '@/components/EmptyState';
import { getPolicy } from '@/content/policies';
import { useStore } from '@/utils/useStore';
import { colors, space } from '@/utils/theme';

// Chính sách bảo mật / Điều khoản sử dụng / Chính sách đổi trả (/policy/privacy | terms | returns).
// Nội dung nằm trong src/content/policies.js. Xem được khi chưa đăng nhập (cửa hàng ứng dụng yêu cầu).
export default function Policy() {
  const params = useLocalSearchParams();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const insets = useSafeAreaInsets();
  const { store } = useStore();
  const policy = getPolicy(String(slug), store);

  if (!policy) {
    return <EmptyState icon="document-text-outline" title="Không tìm thấy nội dung" message="Trang chính sách này không tồn tại." />;
  }

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: space.xl + insets.bottom }]}>
      <Stack.Screen options={{ title: policy.title }} />
      <Text style={styles.title}>{policy.title}</Text>
      <Text style={styles.updated}>Cập nhật lần cuối: {policy.updated}</Text>
      <Text style={styles.p}>{policy.intro}</Text>

      {policy.sections.map((s) => (
        <View key={s.h} style={styles.section}>
          <Text style={styles.h}>{s.h}</Text>
          {(s.p ?? []).map((text) => <Text key={text} style={styles.p}>{text}</Text>)}
          {(s.ul ?? []).map((text) => (
            <View key={text} style={styles.li}>
              <Text style={styles.bullet}>•</Text>
              <Text style={[styles.p, styles.liText]}>{text}</Text>
            </View>
          ))}
        </View>
      ))}

      <Card style={styles.help}>
        <Text style={styles.h}>Cần hỗ trợ thêm?</Text>
        <Text style={styles.p}>Liên hệ {store.name} nếu bạn có câu hỏi về nội dung này.</Text>
        <ContactActions />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, gap: space.md },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  updated: { fontSize: 12, color: colors.muted, marginTop: -6 },
  section: { gap: space.sm, marginTop: space.sm },
  h: { fontSize: 16, fontWeight: '700', color: colors.primaryDark },
  p: { fontSize: 14, color: colors.text, lineHeight: 21 },
  li: { flexDirection: 'row', gap: space.sm, paddingRight: space.sm },
  bullet: { fontSize: 14, color: colors.primary, lineHeight: 21, width: 10 },
  liText: { flex: 1 },
  help: { padding: space.md, gap: space.sm, marginTop: space.lg },
});
