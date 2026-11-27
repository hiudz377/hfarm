import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errMsg } from '@/api/client';
import { fetchMyGroups } from '@/api/groups';
import { useAuth } from '@/auth/AuthProvider';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Field from '@/components/Field';
import KeyboardView from '@/components/KeyboardView';
import Loading from '@/components/Loading';
import Photo from '@/components/Photo';
import { CLAIM_LABEL, durationText, normalizeGroupCode, STATUS_LABEL } from '@/utils/groupBuy';
import { MY_GROUPS_KEY } from '@/utils/queryKeys';
import { usePullRefresh } from '@/utils/useRefresh';
import { colors, radius, space } from '@/utils/theme';

function GroupRow({ g, onPress }) {
  const status = STATUS_LABEL[g.status] ?? STATUS_LABEL.CANCELLED;
  const claim = CLAIM_LABEL[g.claim];
  return (
    <Pressable onPress={onPress} role="link" aria-label={`Mở nhóm ${g.product_name}`}>
      <Card style={styles.row}>
        <Photo uri={g.thumbnail} style={styles.photo} whole />
        <View style={styles.rowText}>
          <Text style={styles.rowName} numberOfLines={2}>{g.product_name}</Text>
          <View style={styles.rowMeta}>
            <Text style={[styles.status, status.tone === 'success' && styles.statusOk, status.tone === 'muted' && styles.statusMuted]}>{status.text}</Text>
            <Text style={styles.muted}>{g.member_count}/{g.capacity} người{g.current_percent ? ` · giảm ${g.current_percent}%` : ''}</Text>
          </View>
          <Text style={styles.muted} numberOfLines={1}>
            {g.status === 'OPEN' ? `Còn ${durationText(g.seconds_left)}` : g.status === 'SUCCESS' && g.claim === 'CAN_CLAIM' ? `Còn ${durationText(g.claim_seconds_left)} để mua` : claim}
            {g.is_leader ? ' · Bạn là chủ nhóm' : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Card>
    </Pressable>
  );
}

// Mua nhóm của tôi: nhập mã nhóm bạn bè gửi + danh sách nhóm đang tham gia. Công khai (nhập mã không cần đăng nhập);
// danh sách nhóm của mình cần đăng nhập.
export default function Groups() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status } = useAuth();
  const signedIn = status === 'authenticated';
  const [input, setInput] = useState('');
  const [error, setError] = useState(null);

  const mine = useQuery({ queryKey: MY_GROUPS_KEY, queryFn: fetchMyGroups, enabled: signedIn });
  const { refreshing, onRefresh } = usePullRefresh(() => mine.refetch());

  const open = () => {
    const code = normalizeGroupCode(input);
    if (!code) {
      setError('Mã nhóm gồm 8 ký tự chữ và số (không có chữ I, O và số 0, 1).');
      return;
    }
    setError(null);
    router.push(`/group/${code}`);
  };

  return (
    <KeyboardView>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space.xl }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={signedIn ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} /> : undefined}
      >
        <Card style={styles.enter}>
          <Text style={styles.title}>Có mã nhóm của bạn bè?</Text>
          <Field
            label="Mã nhóm"
            value={input}
            onChangeText={(v) => { setInput(v.toUpperCase()); setError(null); }}
            error={error}
            placeholder="ABCD 2EFG"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={12}
            returnKeyType="go"
            onSubmitEditing={open}
            aria-label="Mã nhóm"
          />
          <Button title="Vào nhóm" icon="people-outline" onPress={open} />
        </Card>

        <Text style={styles.title}>Nhóm của tôi</Text>
        {!signedIn ? (
          <Card style={styles.empty}>
            <Text style={styles.muted}>Đăng nhập để xem các nhóm bạn đã tạo hoặc tham gia.</Text>
            <Button title="Đăng nhập" variant="outline" onPress={() => router.push('/login')} />
          </Card>
        ) : mine.isPending ? (
          <Loading />
        ) : mine.isError ? (
          <Card style={styles.empty}>
            <Text style={styles.muted}>{errMsg(mine.error)}</Text>
            <Button title="Thử lại" variant="outline" onPress={() => mine.refetch()} />
          </Card>
        ) : mine.data.length === 0 ? (
          <Card style={styles.empty}>
            <Ionicons name="people-outline" size={32} color={colors.primary} />
            <Text style={styles.emptyTitle}>Bạn chưa có nhóm nào</Text>
            <Text style={styles.muted}>Mở một sản phẩm có mục "Mua nhóm" để tạo nhóm, rồi gửi link cho bạn bè. Càng đông người, mỗi người càng được giảm nhiều.</Text>
            <Button title="Xem cửa hàng" variant="outline" onPress={() => router.navigate('/shop')} />
          </Card>
        ) : (
          mine.data.map((g) => <GroupRow key={g.code} g={g} onPress={() => router.push(`/group/${g.code}`)} />)
        )}
      </ScrollView>
    </KeyboardView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, gap: space.lg },
  enter: { padding: space.lg, gap: space.md },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  muted: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  photo: { width: 56, height: 72, borderRadius: radius.sm },
  rowText: { flex: 1, gap: 3 },
  rowName: { fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 19 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  status: { fontSize: 11, fontWeight: '800', color: colors.primaryDark, backgroundColor: colors.primarySoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },
  statusOk: { backgroundColor: colors.primary, color: colors.white },
  statusMuted: { backgroundColor: colors.border, color: colors.muted },
  empty: { padding: space.xl, alignItems: 'center', gap: space.md },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
});
