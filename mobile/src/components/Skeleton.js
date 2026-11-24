import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius, space } from '@/utils/theme';

// Khối xám nhấp nháy thay cho vòng quay khi đang tải: giữ nguyên bố cục nên trang không nhảy khi dữ liệu về.
export default function Skeleton({ style }) {
  const opacity = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.block, { opacity }, style]} />;
}

// Khung thẻ sản phẩm (cùng kích thước ProductCard)
export function ProductCardSkeleton({ width }) {
  return (
    <View style={{ width, gap: space.sm }}>
      <Skeleton style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md }} />
      <Skeleton style={{ height: 11, width: '45%' }} />
      <Skeleton style={{ height: 14, width: '90%' }} />
      <Skeleton style={{ height: 14, width: '55%' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.border, borderRadius: radius.sm },
});
