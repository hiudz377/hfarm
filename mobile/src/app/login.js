import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import LoginPanel from '@/components/LoginPanel';
import { goBack } from '@/utils/nav';

// Màn Đăng nhập / Đăng ký (hiện dạng modal). Cũng là đích của redirect URI hfarm://login sau khi đăng nhập xong.
export default function Login() {
  const router = useRouter();
  const { status, acknowledgeExpired } = useAuth();

  // Đăng nhập xong (kể cả khi bắt đầu từ tab khác) thì đóng màn này
  useEffect(() => {
    if (status === 'authenticated') goBack(router, '/');
  }, [status, router]);

  // Rời màn thì bỏ thông báo "phiên hết hạn" để không hiện lại ở nơi khác
  useEffect(() => acknowledgeExpired, [acknowledgeExpired]);

  return (
    <LoginPanel
      message="Đăng nhập hoặc tạo tài khoản để thêm vào giỏ hàng, đặt hàng và theo dõi đơn."
      dismissLabel="Tiếp tục xem sản phẩm"
      onDismiss={() => goBack(router, '/')}
    />
  );
}
