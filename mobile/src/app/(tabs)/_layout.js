import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cartLineCount, useCart } from '@/utils/useCart';
import { colors, screenHeader } from '@/utils/theme';

const tab = (name, title, icon, extra = {}) => (
  <Tabs.Screen
    name={name}
    options={{
      title,
      tabBarIcon: ({ color, size, focused }) => (
        <Ionicons name={focused ? icon : `${icon}-outline`} size={size} color={color} />
      ),
      ...extra,
    }}
  />
);

export default function TabsLayout() {
  // Cùng khóa ['cart'] với màn Giỏ hàng / Chi tiết sản phẩm: thêm, xóa, đặt hàng xong thì badge đổi ngay
  const { data: cart } = useCart();
  const count = cartLineCount(cart);
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        ...screenHeader,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        // flexShrink: 0: trên bản web nhãn mặc định được phép co lại (flex-shrink 1) nên bị ép còn ~7px cao và cắt mất nửa dưới chữ
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', flexShrink: 0 },
        // Cao 58 + vùng an toàn phía dưới cho biểu tượng và nhãn thoáng hơn mặc định (49)
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 58 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
        },
        tabBarBadgeStyle: { backgroundColor: colors.sale, color: colors.white, fontWeight: '800' },
        // Mở bàn phím (ô mã giảm giá ở tab Giỏ hàng) thì ẩn thanh tab để KeyboardAvoidingView tính đúng chỗ
        tabBarHideOnKeyboard: true,
      }}
    >
      {/* Trang chủ tự vẽ phần đầu (logo + ô tìm kiếm) nên không dùng header */}
      {tab('index', 'Trang chủ', 'home', { headerShown: false })}
      {tab('shop', 'Cửa hàng', 'shirt')}
      {tab('cart', 'Giỏ hàng', 'bag', { tabBarBadge: count > 0 ? (count > 99 ? '99+' : count) : undefined })}
      {tab('orders', 'Đơn hàng', 'receipt')}
      {tab('account', 'Tài khoản', 'person')}
    </Tabs>
  );
}
