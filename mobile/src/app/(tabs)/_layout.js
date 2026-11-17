import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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

  return (
    <Tabs
      screenOptions={{
        ...screenHeader,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        // Mở bàn phím (ô mã giảm giá ở tab Giỏ hàng) thì ẩn thanh tab để KeyboardAvoidingView tính đúng chỗ
        tabBarHideOnKeyboard: true,
      }}
    >
      {tab('index', 'Cửa hàng', 'storefront')}
      {tab('cart', 'Giỏ hàng', 'cart', { tabBarBadge: count > 0 ? (count > 99 ? '99+' : count) : undefined })}
      {tab('orders', 'Đơn hàng', 'receipt')}
      {tab('account', 'Tài khoản', 'person')}
    </Tabs>
  );
}
