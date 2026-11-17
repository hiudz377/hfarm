import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider.jsx';

// Chặn ở giao diện các trang chỉ dành cho admin. Backend vẫn tự kiểm tra quyền (requireRole('admin')).
export default function AdminOnly({ children }) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  if (isAdmin) return children;
  return (
    <Result status="403" title="Không đủ quyền" subTitle="Trang này chỉ dành cho Quản trị viên."
      extra={<Button type="primary" onClick={() => navigate('/')}>Về trang tổng quan</Button>} />
  );
}
