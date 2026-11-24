import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Photo from './Photo';
import { colors, radius, space } from '@/utils/theme';

const GAP = space.md;
const AUTOPLAY_MS = 5000;

// Banner mặc định khi CMS chưa có banner nào đang bật
const FALLBACK = {
  id: 'default',
  fallback: true,
  title: 'Thời trang mỗi ngày',
  subtitle: 'Khám phá các sản phẩm mới nhất của cửa hàng.',
  cta: 'Mua sắm ngay',
};

// Dải banner trượt ngang, tự chuyển sau vài giây (dừng khi người dùng đang kéo), kèm chấm chỉ vị trí.
// banners: dữ liệu từ GET /banners. onOpen(banner): bấm vào banner. onShop(): bấm banner mặc định.
export default function HeroCarousel({ banners, onOpen, onShop }) {
  const { width: screen } = useWindowDimensions();
  const width = screen - space.lg * 2;
  const height = Math.round(width * 0.52);
  const slides = banners?.length ? banners : [FALLBACK];
  const step = width + GAP;

  const list = useRef(null);
  const [index, setIndex] = useState(0);
  const dragging = useRef(false);
  const indexRef = useRef(0);
  indexRef.current = index;

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const timer = setInterval(() => {
      if (dragging.current) return;
      const next = (indexRef.current + 1) % slides.length;
      list.current?.scrollToOffset({ offset: next * step, animated: true });
      setIndex(next);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [slides.length, step]);

  const open = (s) => (s.fallback ? onShop?.() : onOpen?.(s));
  const clickable = (s) => s.fallback || s.link_type !== 'NONE';

  return (
    <View>
      <FlatList
        ref={list}
        data={slides}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => String(s.id)}
        snapToInterval={step}
        decelerationRate="fast"
        contentContainerStyle={styles.list}
        onScrollBeginDrag={() => { dragging.current = true; }}
        onScrollEndDrag={() => { dragging.current = false; }}
        onMomentumScrollEnd={(e) => setIndex(Math.min(slides.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / step))))}
        getItemLayout={(_, i) => ({ length: step, offset: step * i, index: i })}
        renderItem={({ item }) => (
          <Pressable
            disabled={!clickable(item)}
            onPress={() => open(item)}
            style={[styles.slide, { width, height }]}
            role={clickable(item) ? 'link' : 'img'}
            aria-label={item.title}
          >
            {item.fallback ? (
              <View style={styles.fallbackBg}>
                <View style={[styles.ring, { width: height * 1.1, height: height * 1.1, right: -height * 0.3, top: -height * 0.35 }]} />
                <View style={[styles.ring, { width: height * 0.7, height: height * 0.7, right: height * 0.35, bottom: -height * 0.3 }]} />
              </View>
            ) : (
              <Photo uri={item.image_url} style={StyleSheet.absoluteFill} />
            )}
            <View style={[styles.scrim, item.fallback && styles.scrimNone]} />
            <View style={styles.text}>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              {item.subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{item.subtitle}</Text> : null}
              {clickable(item) ? (
                <View style={styles.cta}>
                  <Text style={styles.ctaText}>{item.cta || 'Xem ngay'}</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                </View>
              ) : null}
            </View>
          </Pressable>
        )}
      />
      {slides.length > 1 ? (
        <View style={styles.dots}>
          {slides.map((s, i) => (
            <View key={String(s.id)} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.lg, gap: GAP },
  slide: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.primary, justifyContent: 'flex-end' },
  fallbackBg: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.primary },
  ring: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.30)' },
  scrimNone: { backgroundColor: 'transparent' },
  text: { padding: space.lg, gap: 4 },
  title: { color: colors.white, fontSize: 22, fontWeight: '800', lineHeight: 27 },
  subtitle: { color: 'rgba(255,255,255,0.92)', fontSize: 13, lineHeight: 18 },
  cta: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
  },
  ctaText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotOn: { width: 18, backgroundColor: colors.primary },
});
