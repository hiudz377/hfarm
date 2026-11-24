import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { errMsg } from '@/api/client';
import { fetchPaymentInfo } from '@/api/orders';
import Skeleton from './Skeleton';
import { money } from '@/utils/format';
import { ORDERS_KEY, orderKey, paymentKey, trackingKey } from '@/utils/queryKeys';
import { colors, radius, space } from '@/utils/theme';

const POLL_MS = 4000;

// 90000 giây -> "25 giờ 00 phút"; dưới 1 giờ -> "mm:ss"
function formatLeft(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const p = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h} giờ ${p(m)} phút` : `${p(m)}:${p(s % 60)}`;
}

// Một dòng thông tin kèm nút sao chép
function CopyRow({ label, value, strong }) {
  const [done, setDone] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(String(value));
      setDone(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setDone(false), 1600);
    } catch {
      // thiết bị không cho ghi clipboard: bỏ qua, khách vẫn đọc và gõ tay được
    }
  };
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, strong && styles.strong]} selectable>{value}</Text>
      </View>
      <Pressable onPress={copy} hitSlop={8} style={[styles.copy, done && styles.copyDone]} role="button" aria-label={`Sao chép ${label}`}>
        <Ionicons name={done ? 'checkmark' : 'copy-outline'} size={16} color={done ? colors.white : colors.primary} />
        <Text style={[styles.copyText, done && styles.copyTextDone]}>{done ? 'Đã chép' : 'Chép'}</Text>
      </Pressable>
    </View>
  );
}

// Thanh toán chuyển khoản của một đơn: mã VietQR đúng số tiền + nội dung, đếm ngược hạn trả, tự kiểm tra mỗi vài giây
// và chuyển sang "Đã nhận thanh toán" ngay khi tiền về (cửa hàng bật webhook hoặc nhân viên xác nhận).
// Dữ liệu từ GET /orders/:id/payment; QR sinh ở server nên số tiền và nội dung luôn khớp đơn.
export default function PaymentQR({ orderId }) {
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: paymentKey(orderId),
    queryFn: () => fetchPaymentInfo(orderId),
    staleTime: 0,
    refetchInterval: (query) => (query.state.data?.payable ? POLL_MS : false),
  });
  const data = q.data;

  // Đếm ngược theo số giây server trả về (tính từ lúc nhận), không phụ thuộc giờ máy khách
  const [now, setNow] = useState(Date.now());
  const counting = !!data?.payable && data.seconds_left != null;
  useEffect(() => {
    if (!counting) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [counting]);
  const left = counting ? Math.max(0, data.seconds_left - Math.floor((now - q.dataUpdatedAt) / 1000)) : null;

  // Hết giờ mà server chưa kịp hủy: hỏi lại một lần để hiện đúng trạng thái
  useEffect(() => {
    if (left === 0) q.refetch();
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  // Vừa chuyển UNPAID -> PAID: làm mới đơn, danh sách đơn, hành trình
  const wasUnpaid = useRef(false);
  useEffect(() => {
    if (!data) return;
    if (data.payment_status === 'UNPAID') wasUnpaid.current = true;
    else if (data.payment_status === 'PAID' && wasUnpaid.current) {
      wasUnpaid.current = false;
      queryClient.invalidateQueries({ queryKey: orderKey(orderId) });
      queryClient.invalidateQueries({ queryKey: trackingKey(orderId) });
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    }
  }, [data, orderId, queryClient]);

  if (q.isPending) {
    return (
      <View style={styles.box}>
        <Skeleton style={styles.qrSkeleton} />
        <Skeleton style={{ height: 14, width: '60%', alignSelf: 'center' }} />
      </View>
    );
  }
  if (q.isError && !data) {
    return (
      <View style={styles.box}>
        <Text style={styles.err}>{errMsg(q.error)}</Text>
        <Pressable onPress={() => q.refetch()} role="button"><Text style={styles.retry}>Thử lại</Text></Pressable>
      </View>
    );
  }

  if (data.payment_status === 'PAID') {
    return (
      <View style={[styles.box, styles.paid]}>
        <Ionicons name="checkmark-circle" size={56} color={colors.primary} />
        <Text style={styles.paidTitle}>Đã nhận thanh toán</Text>
        <Text style={styles.sub}>{money(data.amount)} · Cảm ơn bạn! Cửa hàng sẽ chuẩn bị đơn hàng.</Text>
      </View>
    );
  }

  if (!data.payable) {
    const closed = ['CANCELLED', 'RETURNED'].includes(data.order_status);
    return (
      <View style={[styles.box, styles.closed]}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
        <Text style={styles.closedTitle}>{closed ? 'Đơn hàng đã hủy' : data.expired ? 'Đã quá hạn thanh toán' : 'Chưa thể thanh toán'}</Text>
        <Text style={styles.sub}>
          {closed || data.expired
            ? 'Không còn nhận chuyển khoản cho đơn này. Nếu bạn đã chuyển tiền, hãy liên hệ cửa hàng để được hỗ trợ.'
            : 'Cửa hàng chưa bật thanh toán chuyển khoản. Vui lòng liên hệ cửa hàng.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <View style={styles.qrFrame}>
        <Image source={{ uri: data.qr_image }} style={styles.qr} contentFit="contain" accessibilityLabel="Mã QR chuyển khoản" />
      </View>
      <Text style={styles.scan}>Quét mã bằng app ngân hàng bất kỳ</Text>
      <Text style={styles.amount}>{money(data.amount)}</Text>

      {left != null ? (
        <View style={[styles.timer, left < 600 && styles.timerUrgent]}>
          <Ionicons name="time-outline" size={16} color={left < 600 ? colors.danger : colors.primary} />
          <Text style={[styles.timerText, left < 600 && styles.timerTextUrgent]}>Còn {formatLeft(left)} để thanh toán</Text>
        </View>
      ) : null}

      <View style={styles.info}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.label}>Ngân hàng</Text>
            <Text style={styles.value}>{data.bank.bank_name}</Text>
          </View>
        </View>
        <CopyRow label="Số tài khoản" value={data.bank.account_no} strong />
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.label}>Chủ tài khoản</Text>
            <Text style={styles.value}>{data.bank.account_name}</Text>
          </View>
        </View>
        <CopyRow label="Nội dung chuyển khoản" value={data.transfer_content} strong />
      </View>

      <Text style={styles.note}>
        Giữ nguyên nội dung chuyển khoản và số tiền để đơn được ghi nhận. Nếu không quét được, hãy chuyển khoản thủ công theo thông tin trên.
      </Text>
      <View style={styles.waiting}>
        <ActivityIndicator size="small" color={colors.muted} />
        <Text style={styles.waitingText}>Đang chờ thanh toán, trang tự cập nhật khi tiền về</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.md, alignItems: 'stretch' },
  qrSkeleton: { alignSelf: 'center', width: 240, height: 240, borderRadius: radius.md },
  qrFrame: {
    alignSelf: 'center', padding: space.sm, backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  qr: { width: 232, height: 232 },
  scan: { textAlign: 'center', fontSize: 13, color: colors.muted },
  amount: { textAlign: 'center', fontSize: 26, fontWeight: '900', color: colors.primary, letterSpacing: -0.5 },
  timer: {
    alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, backgroundColor: colors.primarySoft,
  },
  timerUrgent: { backgroundColor: colors.dangerSoft },
  timerText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  timerTextUrgent: { color: colors.danger },
  info: { gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  rowText: { flex: 1, gap: 1 },
  label: { fontSize: 12, color: colors.muted },
  value: { fontSize: 14, color: colors.text },
  strong: { fontWeight: '800', fontSize: 15, letterSpacing: 0.3 },
  copy: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface,
  },
  copyDone: { backgroundColor: colors.primary },
  copyText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  copyTextDone: { color: colors.white },
  note: { fontSize: 12, color: colors.muted, lineHeight: 17, textAlign: 'center' },
  waiting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  waitingText: { fontSize: 12, color: colors.muted },
  err: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  retry: { color: colors.primary, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  paid: { alignItems: 'center', paddingVertical: space.lg },
  paidTitle: { fontSize: 18, fontWeight: '800', color: colors.primary },
  sub: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 },
  closed: { alignItems: 'center', paddingVertical: space.md },
  closedTitle: { fontSize: 16, fontWeight: '800', color: colors.danger },
});
