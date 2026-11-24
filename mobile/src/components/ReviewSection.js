import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { errMsg } from '@/api/client';
import { fetchReviews } from '@/api/reviews';
import Button from '@/components/Button';
import Stars from '@/components/Stars';
import { dateTime } from '@/utils/format';
import { reviewsKey } from '@/utils/queryKeys';
import { colors, space } from '@/utils/theme';

const PAGE = 5;

// Điểm trung bình + phân bố 5 → 1 sao + danh sách đánh giá đã duyệt (tải thêm theo trang)
export default function ReviewSection({ productId }) {
  const q = useInfiniteQuery({
    queryKey: reviewsKey(productId),
    queryFn: ({ pageParam }) => fetchReviews({ productId, page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
  });
  const summary = q.data?.pages[0]?.summary;
  const reviews = useMemo(() => {
    const seen = new Map();
    for (const page of q.data?.pages ?? []) for (const r of page.data) if (!seen.has(r.id)) seen.set(r.id, r);
    return [...seen.values()];
  }, [q.data]);

  let body;
  if (q.isPending) {
    body = <ActivityIndicator color={colors.primary} style={styles.center} />;
  } else if (q.isError && !q.data) {
    body = (
      <Pressable onPress={() => q.refetch()} role="button">
        <Text style={styles.retry}>Không tải được đánh giá ({errMsg(q.error)}). Chạm để thử lại</Text>
      </Pressable>
    );
  } else if (!summary || summary.count === 0) {
    body = <Text style={styles.empty}>Chưa có đánh giá nào. Mua hàng và là người đầu tiên chia sẻ cảm nhận!</Text>;
  } else {
    body = (
      <>
        <View style={styles.summary}>
          <View style={styles.avgBox}>
            <Text style={styles.avg}>{summary.average.toFixed(1)}</Text>
            <Stars value={summary.average} size={16} />
            <Text style={styles.muted}>{summary.count} đánh giá</Text>
          </View>
          <View style={styles.bars}>
            {[5, 4, 3, 2, 1].map((star) => {
              const n = summary.distribution[star] ?? 0;
              return (
                <View key={star} style={styles.barRow}>
                  <Text style={styles.barLabel}>{star} sao</Text>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${(n / summary.count) * 100}%` }]} />
                  </View>
                  <Text style={styles.barCount}>{n}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {reviews.map((r) => (
          <View key={r.id} style={styles.review}>
            <View style={styles.reviewHead}>
              <Text style={styles.name}>{r.reviewer_name}</Text>
              <Text style={styles.muted}>{dateTime(r.created_at).slice(0, 10)}</Text>
            </View>
            <Stars value={r.rating} size={13} />
            {r.comment ? <Text style={styles.comment}>{r.comment}</Text> : null}
          </View>
        ))}

        {q.hasNextPage ? (
          <Button title="Xem thêm đánh giá" variant="outline" loading={q.isFetchingNextPage} onPress={() => q.fetchNextPage()} />
        ) : null}
        {q.isFetchNextPageError ? <Text style={styles.retry}>Không tải thêm được đánh giá. Hãy thử lại.</Text> : null}
      </>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Đánh giá{summary && summary.count ? ` (${summary.count})` : ''}</Text>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, paddingTop: space.xl, gap: space.md },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  center: { alignSelf: 'flex-start' },
  empty: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  retry: { fontSize: 14, color: colors.primary, lineHeight: 20 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avgBox: { alignItems: 'center', gap: 4, minWidth: 96 },
  avg: { fontSize: 36, fontWeight: '800', color: colors.text },
  bars: { flex: 1, gap: 5 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 38, fontSize: 12, color: colors.muted },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.gold },
  barCount: { width: 22, fontSize: 12, color: colors.muted, textAlign: 'right' },
  review: { gap: 4, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  reviewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 14, fontWeight: '600', color: colors.text },
  muted: { fontSize: 12, color: colors.muted },
  comment: { fontSize: 14, lineHeight: 20, color: colors.text },
});
