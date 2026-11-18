import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import Loading from '@/components/Loading';
import { colors, screenHeader } from '@/utils/theme';

// retry: false -> lỗi hiện ngay kèm nút "Thử lại" thay vì quay vòng lâu khi sai địa chỉ API
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30 * 1000 } },
});

function Routes() {
  const router = useRouter();
  const { status, sessionExpired } = useAuth();
  const signedIn = status === 'authenticated';

  // Phiên hết hạn giữa chừng (backend từ chối token, refresh token hết hạn): đưa về màn đăng nhập
  useEffect(() => {
    if (sessionExpired) router.push('/login');
  }, [sessionExpired, router]);

  // Đang khôi phục phiên đã lưu từ lần mở trước
  if (status === 'loading') return <Loading />;

  return (
    // headerTransparent: false - từ iOS 26 header mặc định trong suốt và nội dung trượt xuống dưới header
    <Stack screenOptions={{ ...screenHeader, headerTransparent: false, contentStyle: { backgroundColor: colors.bg } }}>
      {/* Xem cửa hàng và sản phẩm tự do, không cần đăng nhập. Giỏ hàng / Đơn hàng / Tài khoản (trong tabs) tự hiện lời mời đăng nhập */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="product/[id]" options={{ title: 'Chi tiết sản phẩm' }} />
      <Stack.Screen name="login" options={{ title: 'Đăng nhập', presentation: 'modal' }} />
      {/* Các màn dưới đây cần đăng nhập: mở bằng liên kết khi chưa đăng nhập hoặc vừa đăng xuất thì bị đưa về màn đầu */}
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="order/[id]" options={{ title: 'Chi tiết đơn hàng' }} />
        <Stack.Screen name="profile" options={{ title: 'Thông tin cá nhân' }} />
        <Stack.Screen name="addresses" options={{ title: 'Sổ địa chỉ' }} />
        <Stack.Screen name="favorites" options={{ title: 'Yêu thích' }} />
        <Stack.Screen name="review" options={{ title: 'Đánh giá sản phẩm', presentation: 'modal' }} />
        <Stack.Screen name="checkout" options={{ title: 'Thanh toán' }} />
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
        <StatusBar style="light" />
        <Routes />
      </AuthProvider>
    </QueryClientProvider>
  );
}
