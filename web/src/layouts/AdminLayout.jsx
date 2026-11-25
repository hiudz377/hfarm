import { useEffect, useMemo, useState } from 'react';
import { Suspense } from 'react';
import { App, Avatar, Badge, Breadcrumb, Dropdown, Layout, Menu, Skeleton, Typography } from 'antd';
import {
  AppstoreOutlined, BankOutlined, BellOutlined, CarOutlined, DashboardOutlined, DownOutlined, GiftOutlined, InboxOutlined,
  LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, PictureOutlined, SkinOutlined, ShoppingCartOutlined, StarOutlined,
  TagsOutlined, TeamOutlined, UserOutlined, WarningOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../auth/AuthProvider.jsx';

// adminOnly: staff không thấy mục này (backend cũng chặn bằng requireRole('admin'))
const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'Tổng quan' },
  { type: 'group', label: 'Bán hàng', children: [
    { key: '/orders', icon: <ShoppingCartOutlined />, label: 'Đơn hàng' },
    { key: '/reviews', icon: <StarOutlined />, label: 'Đánh giá' },
    { key: '/customers', icon: <TeamOutlined />, label: 'Khách hàng', adminOnly: true },
    { key: '/coupons', icon: <GiftOutlined />, label: 'Mã giảm giá', adminOnly: true },
  ] },
  { type: 'group', label: 'Sản phẩm', children: [
    { key: '/products', icon: <SkinOutlined />, label: 'Sản phẩm' },
    { key: '/categories', icon: <AppstoreOutlined />, label: 'Danh mục', adminOnly: true },
    { key: '/brands', icon: <TagsOutlined />, label: 'Thương hiệu', adminOnly: true },
    { key: '/attributes', icon: <TagsOutlined />, label: 'Size & Màu', adminOnly: true },
  ] },
  { type: 'group', label: 'Vận hành', children: [
    { key: '/inventory', icon: <InboxOutlined />, label: 'Kho hàng' },
    { key: '/shipping', icon: <CarOutlined />, label: 'Vận chuyển' },
    { key: '/bank-transactions', icon: <BankOutlined />, label: 'Giao dịch ngân hàng' },
    { key: '/banners', icon: <PictureOutlined />, label: 'Banner', adminOnly: true },
  ] },
];

const pageNames = {
  '/': 'Tổng quan',
  '/products': 'Sản phẩm',
  '/categories': 'Danh mục',
  '/brands': 'Thương hiệu',
  '/attributes': 'Size & Màu',
  '/orders': 'Đơn hàng',
  '/reviews': 'Đánh giá',
  '/customers': 'Khách hàng',
  '/coupons': 'Mã giảm giá',
  '/inventory': 'Kho hàng',
  '/shipping': 'Vận chuyển',
  '/bank-transactions': 'Giao dịch ngân hàng',
  '/banners': 'Banner',
};

export default function AdminLayout() {
  const { message } = App.useApp();
  const { user, isAdmin, roleLabel, logout, accountUrl } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [pendingOrders, setPendingOrders] = useState(0);
  const [pendingReviews, setPendingReviews] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [bankTodo, setBankTodo] = useState(0);
  // Thanh bên thu gọn: nhớ lựa chọn của người dùng (tự thu gọn trên màn hình hẹp, không lưu)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('hfarm.sider.collapsed') === '1'; } catch { return false; }
  });
  const toggleSider = () => setCollapsed((v) => {
    try { localStorage.setItem('hfarm.sider.collapsed', v ? '0' : '1'); } catch { /* không lưu được thì thôi */ }
    return !v;
  });
  const title = pageNames[pathname] || 'Quản trị';
  useEffect(() => { document.title = `${title} · HFarm Quản trị`; }, [title]);

  useEffect(() => {
    let active = true;
    const loadPendingOrders = async () => {
      try {
        const response = await api.get('/admin/orders', { params: { status: 'PENDING', page: 1, limit: 1 } });
        if (active) setPendingOrders(response.data.total);
      } catch (error) {
        if (active) message.error(`Không tải được số đơn chờ xác nhận: ${errMsg(error)}`);
      }
    };
    // Số đánh giá chờ duyệt: lỗi thì bỏ qua âm thầm (chỉ là con số phụ trên menu)
    const loadPendingReviews = async () => {
      try {
        const response = await api.get('/admin/reviews/counts');
        if (active) setPendingReviews(response.data.PENDING);
      } catch { /* bỏ qua */ }
    };
    // Số biến thể sắp hết hàng (≤ 5): cũng chỉ là con số phụ, lỗi thì bỏ qua
    const loadLowStock = async () => {
      try {
        const response = await api.get('/admin/inventory', { params: { page: 1, limit: 1 } });
        if (active) setLowStock(Number(response.data.stats?.low_stock || 0));
      } catch { /* bỏ qua */ }
    };
    // Giao dịch ngân hàng chưa xử lý (không khớp đơn, thiếu/dư tiền...): cũng chỉ là con số phụ
    const loadBankTodo = async () => {
      try {
        const response = await api.get('/admin/bank-transactions', { params: { resolved: 0, page: 1, limit: 1 } });
        if (active) setBankTodo(Number(response.data.total || 0));
      } catch { /* bỏ qua */ }
    };
    const refresh = () => { loadPendingOrders(); loadPendingReviews(); loadLowStock(); loadBankTodo(); };
    refresh();
    window.addEventListener('hfarm:orders-updated', refresh);
    window.addEventListener('hfarm:reviews-updated', refresh);
    return () => {
      active = false;
      window.removeEventListener('hfarm:orders-updated', refresh);
      window.removeEventListener('hfarm:reviews-updated', refresh);
    };
  }, [pathname]);

  const items = useMemo(() => menuItems
    .map((item) => ({
      ...item,
      children: item.children
        ?.filter((child) => isAdmin || !child.adminOnly)
        .map(({ adminOnly, ...child }) => child.key === '/orders' ? {
          ...child,
          label: <span className="menu-order-label">Đơn hàng<Badge count={pendingOrders} overflowCount={99} size="small" /></span>,
        } : child.key === '/reviews' ? {
          ...child,
          label: <span className="menu-order-label">Đánh giá<Badge count={pendingReviews} overflowCount={99} size="small" /></span>,
        } : child.key === '/bank-transactions' ? {
          ...child,
          label: <span className="menu-order-label">Giao dịch ngân hàng<Badge count={bankTodo} overflowCount={99} size="small" /></span>,
        } : child),
    }))
    .filter((item) => !item.children || item.children.length > 0), // bỏ nhóm không còn mục nào
  [pendingOrders, pendingReviews, bankTodo, isAdmin]);

  // Chuông: gom các việc cần xử lý (chỉ hiện mục có số > 0), bấm để tới trang tương ứng
  const todo = [
    { key: '/orders', count: pendingOrders, icon: <ShoppingCartOutlined />, text: 'đơn chờ xác nhận' },
    { key: '/reviews', count: pendingReviews, icon: <StarOutlined />, text: 'đánh giá chờ duyệt' },
    { key: '/inventory', count: lowStock, icon: <WarningOutlined />, text: 'biến thể sắp hết hàng' },
    { key: '/bank-transactions', count: bankTodo, icon: <BankOutlined />, text: 'giao dịch ngân hàng cần xử lý' },
  ].filter((t) => t.count > 0);
  const bellCount = todo.reduce((sum, t) => sum + t.count, 0);
  const bellMenu = {
    items: todo.length
      ? [{ type: 'group', label: 'Cần xử lý', children: todo.map((t) => ({
        key: t.key,
        icon: t.icon,
        label: <span className="bell-item"><span>{t.text}</span><b>{t.count}</b></span>,
      })) }]
      : [{ key: 'none', disabled: true, label: 'Không có việc cần xử lý' }],
    onClick: ({ key }) => { if (key !== 'none') navigate(key); },
  };

  const userMenu = {
    items: [
      ...(accountUrl ? [{
        key: 'account',
        icon: <UserOutlined />,
        label: <a href={accountUrl} target="_blank" rel="noopener noreferrer">Quản lý tài khoản</a>,
      }, { type: 'divider' }] : []),
      { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true },
    ],
    onClick: ({ key }) => { if (key === 'logout') logout(); },
  };

  return (
    <Layout className="admin-layout" style={{ minHeight: '100vh' }}>
      <Layout.Sider className="admin-sider" breakpoint="lg" collapsedWidth={64} collapsible trigger={null} collapsed={collapsed}
        onBreakpoint={(broken) => { if (broken) setCollapsed(true); }}>
        {/* Logo nền kem trong thẻ bo góc (chữ xanh đậm của logo không đọc được trực tiếp trên nền xanh của thanh bên).
            Thu gọn thanh bên: chỉ còn biểu tượng (CSS ẩn/hiện hai ảnh theo .ant-layout-sider-collapsed) */}
        <div className="brand-lockup">
          <div className="brand-card">
            <img className="brand-logo-full" src="/logo-compact.png" alt="HFarm Thời trang" />
            <img className="brand-logo-mini" src="/logo-mark.png" alt="HFarm" />
          </div>
          <Typography.Text className="brand-subtitle">QUẢN TRỊ CỬA HÀNG</Typography.Text>
        </div>
        <Menu
          className="admin-menu"
          theme="dark"
          mode="inline"
          selectedKeys={[pathname]}
          items={items}
          onClick={({ key }) => navigate(key)}
        />
      </Layout.Sider>
      <Layout className="admin-main">
        <Layout.Header className="admin-header">
          <div className="header-left">
            <button type="button" className="header-trigger" onClick={toggleSider} aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}>
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </button>
            <Breadcrumb items={[{ title: 'HFarm' }, { title }]} />
          </div>
          <div className="header-right">
          <Dropdown menu={bellMenu} trigger={['click']} placement="bottomRight">
            <button type="button" className="bell-btn" aria-label={bellCount ? `Thông báo: ${bellCount} việc cần xử lý` : 'Thông báo: không có việc cần xử lý'}>
              <Badge count={bellCount} size="small" overflowCount={99}><BellOutlined style={{ fontSize: 18, color: '#4a574b' }} /></Badge>
            </button>
          </Dropdown>
          <Dropdown menu={userMenu} trigger={['click']} placement="bottomRight">
            <button type="button" className="header-user" aria-label="Menu tài khoản">
              <Avatar size="small" style={{ background: '#e8f5e9', color: '#2e7d32' }}>
                {user.name.trim().charAt(0).toUpperCase() || <UserOutlined />}
              </Avatar>
              <span className="header-user-text">
                <Typography.Text strong className="header-user-name">{user.name}</Typography.Text>
                <Typography.Text type="secondary" className="header-user-role">{roleLabel}</Typography.Text>
              </span>
              <DownOutlined className="header-user-caret" />
            </button>
          </Dropdown>
          </div>
        </Layout.Header>
        <Layout.Content className="admin-content">
          <Suspense fallback={<Skeleton active paragraph={{ rows: 5 }} />}>
            <Outlet />
          </Suspense>
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
