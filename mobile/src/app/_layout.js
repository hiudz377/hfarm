import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import EmptyState from '@/components/EmptyState';
import Loading from '@/components/Loading';
import { colors, screenHeader } from '@/utils/theme';

// retry: false -> lỗi hiện ngay kèm nút "Thử lại" thay vì quay vòng lâu khi sai địa chỉ API
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30 * 1000 } },
});

function Routes() {
  const { status } = useAuth();
  if (status === 'loading') return <Loading />;
  // TODO(keycloak): thay bằng màn hình đăng nhập khi status === 'unauthenticated'
  if (status !== 'authenticated') {
    return <EmptyState icon="lock-closed-outline" title="Chưa đăng nhập" message={__DEV__ ? "Chưa hỗ trợ đăng nhập. [dev] Đặt EXPO_PUBLIC_AUTH_MODE=dev trong mobile/.env." : "Tính năng đăng nhập chưa sẵn sàng. Vui lòng thử lại sau."} />;
  }
  return (
    // headerTransparent: false - từ iOS 26 header mặc định trong suốt và nội dung trượt xuống dưới header
    <Stack screenOptions={{ ...screenHeader, headerTransparent: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="product/[id]" options={{ title: 'Chi tiết sản phẩm' }} />
      <Stack.Screen name="order/[id]" options={{ title: 'Chi tiết đơn hàng' }} />
      <Stack.Screen name="profile" options={{ title: 'Thông tin cá nhân' }} />
      <Stack.Screen name="addresses" options={{ title: 'Sổ địa chỉ' }} />
      <Stack.Screen name="checkout" options={{ title: 'Thanh toán' }} />
      <Stack.Screen name="address-form" options={{ title: 'Địa chỉ', presentation: 'modal' }} />
      {/* Đã đặt xong: không cho vuốt/bấm quay lại màn thanh toán (giỏ đã trống) */}
      <Stack.Screen name="order-success" options={{ title: 'Đặt hàng thành công', headerBackVisible: false, headerLeft: () => null, gestureEnabled: false }} />
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
