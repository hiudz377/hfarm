import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout.jsx';
import AdminOnly from './auth/AdminOnly.jsx';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Products = lazy(() => import('./pages/Products.jsx'));
const Orders = lazy(() => import('./pages/Orders.jsx'));
const Customers = lazy(() => import('./pages/Customers.jsx'));
const CrudPage = lazy(() => import('./pages/CrudPage.jsx'));
const Inventory = lazy(() => import('./pages/Inventory.jsx'));
const Attributes = lazy(() => import('./pages/Attributes.jsx'));
const Coupons = lazy(() => import('./pages/Coupons.jsx'));

const categoryFields = (rows) => [
  { name: 'name', label: 'Tên danh mục', required: true },
  { name: 'description', label: 'Mô tả', type: 'textarea' },
  { name: 'parent_id', label: 'Danh mục cha', type: 'select',
    options: rows.map((r) => ({ value: r.id, label: r.name })) },
  { name: 'is_active', label: 'Đang hoạt động', type: 'switch' },
];

const brandFields = () => [
  { name: 'name', label: 'Tên thương hiệu', required: true },
  { name: 'description', label: 'Mô tả', type: 'textarea' },
  { name: 'logo_url', label: 'Link logo' },
  { name: 'is_active', label: 'Đang hoạt động', type: 'switch' },
];

export default function App() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/inventory" element={<Inventory />} />
        {/* Chỉ admin: Size & Màu, Mã giảm giá, Danh mục, Thương hiệu, Khách hàng (khớp requireRole('admin') ở backend) */}
        <Route path="/attributes" element={<AdminOnly><Attributes /></AdminOnly>} />
        <Route path="/coupons" element={<AdminOnly><Coupons /></AdminOnly>} />
        <Route path="/categories"
          element={<AdminOnly><CrudPage title="Danh mục" endpoint="/admin/categories" fields={categoryFields}
            columns={[{ title: 'Tên', dataIndex: 'name' }, { title: 'Slug', dataIndex: 'slug' }]} /></AdminOnly>} />
        <Route path="/brands"
          element={<AdminOnly><CrudPage title="Thương hiệu" endpoint="/admin/brands" fields={brandFields}
            columns={[{ title: 'Tên', dataIndex: 'name' }, { title: 'Mô tả', dataIndex: 'description' }]} /></AdminOnly>} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/customers" element={<AdminOnly><Customers /></AdminOnly>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
