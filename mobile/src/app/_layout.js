import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import BrandSplash from '@/components/BrandSplash';
import { giftHeader } from '@/utils/giftTheme';
import { colors, screenHeader } from '@/utils/theme';

// Màn hình chờ có logo hiện ít nhất chừng này ms từ lúc mở app (khôi phục phiên thường xong trong vài chục ms nên nếu
// không giữ lại thì logo chỉ nháy lên rồi mất). Phiên lâu hơn thì chờ đến khi xong, không cộng thêm.
const SPLASH_MIN_MS = 1200;

// retry: false -> lỗi hiện ngay kèm nút "Thử lại" thay vì quay vòng lâu khi sai địa chỉ API
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30 * 1000 } },
});

function Routes() {
  const router = useRouter();
  const { status, sessionExpired } = useAuth();
  const signedIn = status === 'authenticated';
  const [splashDone, setSplashDone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  // Phiên hết hạn giữa chừng (backend từ chối token, refresh token hết hạn): đưa về màn đăng nhập
  useEffect(() => {
    if (sessionExpired) router.push('/login');
  }, [sessionExpired, router]);

  // Đang khôi phục phiên đã lưu từ lần mở trước (hoặc chưa đủ thời gian hiện logo)
  if (status === 'loading' || !splashDone) return <BrandSplash />;

  return (
    // headerTransparent: false - từ iOS 26 header mặc định trong suốt và nội dung trượt xuống dưới header
    <Stack screenOptions={{ ...screenHeader, headerTransparent: false, contentStyle: { backgroundColor: colors.bg } }}>
      {/* Xem cửa hàng và sản phẩm tự do, không cần đăng nhập. Giỏ hàng / Đơn hàng / Tài khoản (trong tabs) tự hiện lời mời đăng nhập */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="product/[id]" options={{ title: 'Chi tiết sản phẩm' }} />
      <Stack.Screen name="login" options={{ title: 'Đăng nhập', presentation: 'modal' }} />
      {/* Công khai: cửa hàng ứng dụng yêu cầu xem được chính sách và cách liên hệ khi chưa đăng nhập */}
      <Stack.Screen name="contact" options={{ title: 'Liên hệ & hỗ trợ' }} />
      <Stack.Screen name="policy/[slug]" options={{ title: 'Chính sách' }} />
      <Stack.Screen name="size-guide" options={{ title: 'Hướng dẫn chọn size', presentation: 'modal' }} />
      {/* Công khai: ai cũng nhờ Stylist gợi ý được; thêm vào giỏ mới cần đăng nhập (màn tự hỏi) */}
      <Stack.Screen name="stylist" options={{ title: 'Stylist cho bạn' }} />
      {/* Quà tặng: công khai như Stylist (xin gợi ý không cần đăng nhập); chọn quà thì màn tự hỏi đăng nhập. Header rượu vang để khác Stylist */}
      <Stack.Screen name="gift" options={{ title: 'Quà tặng', ...giftHeader }} />
      {/* Mua nhóm: xem nhóm công khai (người được mời bấm link hfarm://group/<mã> xem trước khi đăng nhập); thao tác tự hỏi đăng nhập */}
      <Stack.Screen name="group/[code]" options={{ title: 'Mua nhóm' }} />
      <Stack.Screen name="groups" options={{ title: 'Mua nhóm của tôi' }} />
      {/* Các màn dưới đây cần đăng nhập: mở bằng liên kết khi chưa đăng nhập hoặc vừa đăng xuất thì bị đưa về màn đầu */}
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="order/[id]" options={{ title: 'Chi tiết đơn hàng' }} />
        <Stack.Screen name="profile" options={{ title: 'Thông tin cá nhân' }} />
        <Stack.Screen name="addresses" options={{ title: 'Sổ địa chỉ' }} />
        <Stack.Screen name="favorites" options={{ title: 'Yêu thích' }} />
        <Stack.Screen name="review" options={{ title: 'Đánh giá sản phẩm', presentation: 'modal' }} />
        <Stack.Screen name="checkout" options={{ title: 'Thanh toán' }} />
        {/* Viết thiệp cho đơn quà: lấy hàng từ giỏ nên cần đăng nhập */}
        <Stack.Screen name="gift-card" options={{ title: 'Viết thiệp', ...giftHeader }} />
        <Stack.Screen name="address-form" options={{ title: 'Địa chỉ', presentation: 'modal' }} />
        {/* Đã đặt xong: không cho vuốt/bấm quay lại màn thanh toán (giỏ đã trống) */}
        <Stack.Screen name="order-success" options={{ title: 'Đặt hàng thành công', headerBackVisible: false, headerLeft: () => null, gestureEnabled: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="dark" />
        <Routes />
      </AuthProvider>
    </QueryClientProvider>
  );
}
