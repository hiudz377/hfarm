import { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { errMsg } from '@/api/client';
import { createReview } from '@/api/reviews';
import Button from '@/components/Button';
import KeyboardView from '@/components/KeyboardView';
import Stars from '@/components/Stars';
import { goBack } from '@/utils/nav';
import { orderKey, reviewsKey } from '@/utils/queryKeys';
import { useMounted } from '@/utils/useMounted';
import { colors, radius, space } from '@/utils/theme';

const MAX = 1000;
const LABELS = ['', 'Rất tệ', 'Chưa tốt', 'Bình thường', 'Tốt', 'Rất tốt'];

// Viết đánh giá cho một món trong đơn đã hoàn thành. params: orderItemId, orderId, productId, productName
export default function WriteReview() {
  const { orderItemId, orderId, productId, productName } = useLocalSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const mounted = useMounted();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const sending = useRef(false); // chống bấm đúp trong cùng nhịp

  const send = useMutation({
    mutationFn: () => createReview({ orderItemId: Number(orderItemId), rating, comment: comment.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKey(orderId) });
      if (productId) queryClient.invalidateQueries({ queryKey: reviewsKey(productId) });
      Alert.alert('Cảm ơn bạn đã đánh giá!', 'Đánh giá sẽ hiển thị công khai sau khi cửa hàng duyệt.', [
        { text: 'Đóng', onPress: () => mounted.current && goBack(router, '/orders') },
      ]);
    },
    onError: (e) => {
      // Ví dụ 409: đã đánh giá rồi (gửi từ máy khác): tải lại đơn để nút đổi trạng thái
      queryClient.invalidateQueries({ queryKey: orderKey(orderId) });
      Alert.alert('Không gửi được đánh giá', errMsg(e));
    },
    onSettled: () => {
      sending.current = false;
    },
  });

  const submit = () => {
    if (!rating || sending.current || send.isPending) return;
    sending.current = true;
    send.mutate();
  };

  return (
    <KeyboardView>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.product} numberOfLines={2}>{productName}</Text>
        <View style={styles.starBox}>
          <Stars value={rating} size={40} onChange={setRating} />
          <Text style={styles.label}>{rating ? LABELS[rating] : 'Chạm vào sao để chấm điểm'}</Text>
        </View>
        <TextInput
          style={styles.input}
          value={comment}
          onChangeText={(t) => setComment(t.slice(0, MAX))}
          placeholder="Chia sẻ cảm nhận về chất liệu, kiểu dáng, độ vừa vặn... (không bắt buộc)"
          placeholderTextColor={colors.muted}
          multiline
          textAlignVertical="top"
          aria-label="Nhận xét"
        />
        <Text style={styles.count}>{comment.length}/{MAX}</Text>
        <Button title={rating ? 'Gửi đánh giá' : 'Chọn số sao để gửi'} disabled={!rating} loading={send.isPending} onPress={submit} />
        <Text style={styles.note}>Đánh giá được cửa hàng duyệt trước khi hiển thị công khai.</Text>
      </ScrollView>
    </KeyboardView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, gap: space.md },
  product: { fontSize: 17, fontWeight: '700', color: colors.text },
  starBox: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  label: { fontSize: 14, color: colors.muted },
  input: {
    minHeight: 130,
    padding: space.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  count: { fontSize: 12, color: colors.muted, textAlign: 'right' },
  note: { fontSize: 12, color: colors.muted, textAlign: 'center' },
});
