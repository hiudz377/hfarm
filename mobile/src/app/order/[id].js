import { useRef } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errMsg } from '@/api/client';
import { cancelOrder, fetchOrder } from '@/api/orders';
import BankInfo from '@/components/BankInfo';
import Button from '@/components/Button';
import Card from '@/components/Card';
import EmptyState from '@/components/EmptyState';
import Loading from '@/components/Loading';
import PriceSummary from '@/components/PriceSummary';
import StatusBadge from '@/components/StatusBadge';
import Timeline from '@/components/Timeline';
import { dateTime, money } from '@/utils/format';
import { goToTab } from '@/utils/nav';
import { paymentStatusLabel, shipmentStatusLabel } from '@/utils/orderStatus';
import { paymentLabel } from '@/utils/payment';
import { orderKey } from '@/utils/queryKeys';
import { afterOrderCancelled } from '@/utils/useCart';
import { useFocusRefresh, usePullRefresh } from '@/utils/useRefresh';
import { colors, space } from '@/utils/theme';

function Section({ title, children }) {
  return (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </Card>
  );
}

const Row = ({ label, value, strong }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={[styles.value, strong && styles.strong]} selectable>{value}</Text>
  </View>
);

export default function OrderDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const q = useQuery({ queryKey: orderKey(id), queryFn: () => fetchOrder(id), staleTime: 0 }); // trạng thái đơn đổi ở CMS: luôn tải lại khi mở
  const order = q.data;
  useFocusRefresh(orderKey(id)); // CMS có thể đã đổi trạng thái
  const { refreshing, onRefresh } = usePullRefresh(q.refetch);

  // ---- hủy đơn (chỉ khi còn PENDING) ----
  const busy = useRef(false); // chống bấm đúp trong cùng nhịp
  const cancel = useMutation({
    mutationFn: () => cancelOrder(id),
    onSuccess: () => {
      afterOrderCancelled(queryClient, id); // làm mới danh sách + chi tiết + tồn kho sản phẩm (backend đã hoàn kho)
      Alert.alert('Đã hủy đơn', `Đơn ${order.order_code} đã được hủy.`);
    },
    onError: (e) => {
      // Ví dụ CMS vừa xác nhận đơn: backend từ chối. Tải lại để hiện trạng thái thật.
      Alert.alert('Không hủy được đơn', errMsg(e));
      afterOrderCancelled(queryClient, id);
    },
    onSettled: () => {
      busy.current = false;
    },
  });
  const confirmCancel = () =>
    Alert.alert('Hủy đơn hàng?', `Đơn ${order.order_code} sẽ bị hủy và không thể khôi phục.`, [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Hủy đơn',
        style: 'destructive',
        onPress: () => {
          if (busy.current || cancel.isPending) return;
          busy.current = true;
          cancel.mutate();
        },
      },
    ]);

  if (q.isPending) return <Loading />;
  if (q.isError && !order) {
    const notFound = q.error?.response?.status === 404;
    return (
      <EmptyState
        icon={notFound ? 'receipt-outline' : 'cloud-offline-outline'}
        title={notFound ? 'Không tìm thấy đơn hàng' : 'Không tải được đơn hàng'}
        message={errMsg(q.error)}
        actionLabel={notFound ? 'Về danh sách đơn' : 'Thử lại'}
        onAction={notFound ? () => goToTab(router, '/orders') : () => q.refetch()}
      />
    );
  }

  const method = order.payment?.payment_method;
  const ship = order.shipment;
  const canCancel = order.status === 'PENDING';
  const needTransfer = method === 'BANK_TRANSFER' && order.payment_status === 'UNPAID' && !['CANCELLED', 'RETURNED'].includes(order.status);

  return (
    <View style={styles.screen}>
      <ScrollView
        // không có thanh nút dưới (đơn không còn hủy được): tự chừa chỗ cho thanh điều hướng của Android / thanh home của iPhone
        contentContainerStyle={[styles.scroll, { paddingBottom: space.xl + (canCancel ? 0 : insets.bottom) }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        <Card style={styles.head}>
          <View style={styles.headTop}>
            <Text style={styles.code} selectable>{order.order_code}</Text>
            <StatusBadge status={order.status} />
          </View>
          <Text style={styles.date}>Đặt lúc {dateTime(order.created_at)}</Text>
        </Card>

        <Section title="Trạng thái đơn hàng">
          <Timeline history={order.history} />
        </Section>

        <Section title={`Sản phẩm (${order.items.length})`}>
          {order.items.map((it) => (
            <View key={it.id} style={styles.item}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{it.product_name}</Text>
                <Text style={styles.muted}>{[it.color_name, it.size_name].filter(Boolean).join(' / ')}</Text>
                <Text style={styles.muted}>{money(it.unit_price)} x {it.quantity}</Text>
              </View>
              <Text style={styles.itemTotal}>{money(it.line_total)}</Text>
            </View>
          ))}
        </Section>

        <Section title="Địa chỉ nhận hàng">
          <Text style={styles.itemName}>{order.recipient_name} · {order.recipient_phone}</Text>
          <Text style={styles.addr}>
            {[order.shipping_address, order.ward, order.district, order.province].filter(Boolean).join(', ')}
          </Text>
          {order.customer_note ? <Text style={styles.muted}>Ghi chú: {order.customer_note}</Text> : null}
        </Section>

        {ship && (ship.tracking_code || ship.carrier) ? (
          <Section title="Vận chuyển">
            {ship.carrier ? <Row label="Đơn vị vận chuyển" value={ship.carrier} /> : null}
            {ship.tracking_code ? <Row label="Mã vận đơn" value={ship.tracking_code} strong /> : null}
            <Row label="Tình trạng" value={shipmentStatusLabel(ship.status)} />
          </Section>
        ) : null}

        <Section title="Thanh toán">
          <Row label="Phương thức" value={paymentLabel(method)} />
          <Row label="Tình trạng" value={paymentStatusLabel(order.payment_status)} strong />
          <View style={styles.divider} />
          <PriceSummary
            subtotal={order.subtotal}
            discount={order.discount_amount}
            shipping={order.shipping_fee}
            total={order.total_amount}
          />
        </Section>

        {needTransfer ? (
          <Section title="Thông tin chuyển khoản">
            <BankInfo orderCode={order.order_code} />
          </Section>
        ) : null}
      </ScrollView>

      {canCancel ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
          <Button title="Hủy đơn" variant="danger" loading={cancel.isPending} onPress={confirmCancel} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: space.lg, gap: space.md, paddingBottom: space.xl },
  head: { padding: space.md, gap: 6 },
  headTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  code: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text },
  date: { fontSize: 13, color: colors.muted },
  section: { padding: space.md, gap: space.sm },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  item: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.text },
  itemTotal: { fontSize: 14, fontWeight: '600', color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  addr: { fontSize: 14, color: colors.text, lineHeight: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  label: { fontSize: 14, color: colors.muted },
  value: { fontSize: 14, color: colors.text, flexShrink: 1, textAlign: 'right' },
  strong: { fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: space.xs },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
});
