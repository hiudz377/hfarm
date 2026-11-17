import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { errMsg } from '@/api/client';
import { fetchMe } from '@/api/me';
import { useAuth } from '@/auth/AuthProvider';
import Button from '@/components/Button';
import Card from '@/components/Card';
import EmptyState from '@/components/EmptyState';
import Loading from '@/components/Loading';
import MenuRow from '@/components/MenuRow';
import Photo from '@/components/Photo';
import { dateTime } from '@/utils/format';
import { ME_KEY } from '@/utils/queryKeys';
import { AUTH_MODE } from '@/utils/config';
import { useFocusRefresh, usePullRefresh } from '@/utils/useRefresh';
import { colors, space } from '@/utils/theme';

export default function Account() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { signOut } = useAuth();

  const me = useQuery({ queryKey: ME_KEY, queryFn: fetchMe });
  useFocusRefresh(ME_KEY);
  const { refreshing, onRefresh } = usePullRefresh(me.refetch);

  const confirmSignOut = () =>
    Alert.alert('Đăng xuất?', 'Bạn có chắc muốn đăng xuất khỏi tài khoản này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          // Xóa dữ liệu của phiên cũ (giỏ, đơn, địa chỉ...) rồi tải lại; về tab Cửa hàng
          await queryClient.resetQueries();
          router.navigate('/'); // đang ở trong (tabs): navigate chỉ đổi tab
          if (AUTH_MODE === 'dev') {
            Alert.alert(
              'Đã đăng xuất (chế độ dev)',
              'Chế độ dev chưa có đăng nhập thật nên app vẫn dùng tài khoản khách hàng thử nghiệm. Dữ liệu tạm trong app đã được làm mới.',
            );
          }
        },
      },
    ]);

  if (me.isPending) return <Loading />;
  if (me.isError && !me.data) {
    return <EmptyState icon="cloud-offline-outline" title="Không tải được tài khoản" message={errMsg(me.error)} actionLabel="Thử lại" onAction={() => me.refetch()} />;
  }

  const u = me.data;
  const name = u.full_name || 'Chưa đặt tên';
  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
    >
      <Card style={styles.profile}>
        {u.avatar_url ? (
          <Photo uri={u.avatar_url} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.initial}>{name.trim().charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.sub} numberOfLines={1}>{u.email}</Text>
          <Text style={styles.sub}>{u.phone || 'Chưa có số điện thoại'}</Text>
          {u.created_at ? <Text style={styles.sub}>Tham gia {dateTime(u.created_at).slice(0, 10)}</Text> : null}
        </View>
      </Card>

      <Card>
        <MenuRow icon="person-outline" title="Thông tin cá nhân" subtitle="Họ tên, số điện thoại" onPress={() => router.push('/profile')} />
        <MenuRow icon="location-outline" title="Sổ địa chỉ" subtitle="Thêm, sửa, xóa, đặt mặc định" onPress={() => router.push('/addresses')} />
        <MenuRow icon="receipt-outline" title="Đơn hàng của tôi" subtitle="Xem và theo dõi đơn" onPress={() => router.navigate('/orders')} last />
      </Card>

      <Button title="Đăng xuất" variant="danger" onPress={confirmSignOut} />
      {AUTH_MODE === 'dev' ? (
        <Text style={styles.devNote}>Chế độ dev: chưa có phiên đăng nhập thật nên "Đăng xuất" chỉ làm mới dữ liệu tạm trong app.</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, gap: space.lg },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 26, fontWeight: '700', color: colors.white },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.muted },
  devNote: { fontSize: 12, color: colors.muted, textAlign: 'center', lineHeight: 17 },
});
