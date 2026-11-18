import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import LoginForm from '@/components/LoginForm';
import { goBack } from '@/utils/nav';

// Màn Đăng nhập / Đăng ký (hiện dạng modal): form ngay trong app. ?mode=up mở thẳng tab Đăng ký.
// Cũng là đích của redirect URI hfarm://login khi dùng đăng nhập bằng trình duyệt (dự phòng).
export default function Login() {
  const router = useRouter();
  const { mode } = useLocalSearchParams();
  const { status, acknowledgeExpired } = useAuth();

  // Đăng nhập xong (kể cả khi bắt đầu từ tab khác) thì đóng màn này
  useEffect(() => {
    if (status === 'authenticated') goBack(router, '/');
  }, [status, router]);

  // Rời màn thì bỏ thông báo "phiên hết hạn" để không hiện lại ở nơi khác
  useEffect(() => acknowledgeExpired, [acknowledgeExpired]);

  return <LoginForm initialMode={mode === 'up' ? 'up' : 'in'} dismissLabel="Tiếp tục xem sản phẩm" onDismiss={() => goBack(router, '/')} />;
}
