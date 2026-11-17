import { useEffect, useMemo, useState } from 'react';
import { Suspense } from 'react';
import { App, Avatar, Badge, Breadcrumb, Layout, Menu, Skeleton, Space, Typography } from 'antd';
import {
  AppstoreOutlined, DashboardOutlined, GiftOutlined, InboxOutlined, SkinOutlined,
  ShoppingCartOutlined, TagsOutlined, TeamOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api';

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'Tổng quan' },
  { type: 'group', label: 'Bán hàng', children: [
    { key: '/orders', icon: <ShoppingCartOutlined />, label: 'Đơn hàng' },
    { key: '/customers', icon: <TeamOutlined />, label: 'Khách hàng' },
    { key: '/coupons', icon: <GiftOutlined />, label: 'Mã giảm giá' },
  ] },
  { type: 'group', label: 'Sản phẩm', children: [
    { key: '/products', icon: <SkinOutlined />, label: 'Sản phẩm' },
    { key: '/categories', icon: <AppstoreOutlined />, label: 'Danh mục' },
    { key: '/brands', icon: <TagsOutlined />, label: 'Thương hiệu' },
    { key: '/attributes', icon: <TagsOutlined />, label: 'Size & Màu' },
  ] },
  { type: 'group', label: 'Vận hành', children: [
    { key: '/inventory', icon: <InboxOutlined />, label: 'Kho hàng' },
  ] },
];

const pageNames = {
  '/': 'Tổng quan',
  '/products': 'Sản phẩm',
  '/categories': 'Danh mục',
  '/brands': 'Thương hiệu',
  '/attributes': 'Size & Màu',
  '/orders': 'Đơn hàng',
  '/customers': 'Khách hàng',
  '/coupons': 'Mã giảm giá',
  '/inventory': 'Kho hàng',
};

function BrandMark() {
  return (
    <svg className="brand-mark" width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M25.8 5.3C16 5.3 8 9.2 8 17.2c0 3.5 2.5 5.7 5.6 5.7 7.7 0 12.2-7.5 12.2-17.6Z" fill="currentColor" />
      <path d="M6 27c3.4-7.2 8-11.4 15.1-15" stroke="#183C21" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.2 14.4c3.2-.2 5.8.8 7.9 2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function AdminLayout() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [pendingOrders, setPendingOrders] = useState(0);
  const title = pageNames[pathname] || 'Quản trị';

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
    const refresh = () => { loadPendingOrders(); };
    refresh();
    window.addEventListener('hfarm:orders-updated', refresh);
    return () => {
      active = false;
      window.removeEventListener('hfarm:orders-updated', refresh);
    };
  }, [pathname]);

  const items = useMemo(() => menuItems.map((item) => ({
    ...item,
    children: item.children?.map((child) => child.key === '/orders' ? {
      ...child,
      label: <span className="menu-order-label">Đơn hàng<Badge count={pendingOrders} overflowCount={99} size="small" /></span>,
    } : child),
  })), [pendingOrders]);

  return (
    <Layout className="admin-layout" style={{ minHeight: '100vh' }}>
      <Layout.Sider className="admin-sider" breakpoint="lg" collapsedWidth={64}>
        <div className="brand-lockup">
          <BrandMark />
          <div className="brand-copy">
            <Typography.Text strong className="brand-name">HFarm</Typography.Text>
            <Typography.Text className="brand-subtitle">QUẢN TRỊ CỬA HÀNG</Typography.Text>
          </div>
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
          <Breadcrumb items={[{ title: 'HFarm' }, { title }]} />
          <Space size={10}>
            <Avatar size="small" style={{ background: '#e8f5e9', color: '#2e7d32' }}>Q</Avatar>
            <Typography.Text>Quản trị viên</Typography.Text>
          </Space>
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
