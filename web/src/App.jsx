import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Typography } from 'antd';
import { PictureOutlined } from '@ant-design/icons';
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
const Reviews = lazy(() => import('./pages/Reviews.jsx'));
const Shipping = lazy(() => import('./pages/Shipping.jsx'));
const BankTransactions = lazy(() => import('./pages/BankTransactions.jsx'));
const Banners = lazy(() => import('./pages/Banners.jsx'));
const Groups = lazy(() => import('./pages/Groups.jsx'));

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
        {/* Vận chuyển + Giao dịch ngân hàng: staff được xem (và xử lý giao dịch), chỉ admin sửa vùng ship; Banner chỉ admin */}
        <Route path="/shipping" element={<Shipping />} />
        <Route path="/bank-transactions" element={<BankTransactions />} />
        <Route path="/banners" element={<AdminOnly><Banners /></AdminOnly>} />
        {/* Chỉ admin: Size & Màu, Mã giảm giá, Danh mục, Thương hiệu, Khách hàng (khớp requireRole('admin') ở backend) */}
        <Route path="/attributes" element={<AdminOnly><Attributes /></AdminOnly>} />
        <Route path="/coupons" element={<AdminOnly><Coupons /></AdminOnly>} />
        <Route path="/categories"
          element={<AdminOnly><CrudPage title="Danh mục" endpoint="/admin/categories" fields={categoryFields}
            deleteHint="Danh mục đang có sản phẩm thì không xóa được, hãy chuyển sang ngừng hoạt động."
            columns={[{ title: 'Danh mục', dataIndex: 'name', render: (name, r) => (<div><Typography.Text strong>{name}</Typography.Text><div className="cell-sub">/{r.slug}</div></div>) }, { title: 'Mô tả', dataIndex: 'description', render: (d) => d || <span className="muted-dash">—</span> }]} /></AdminOnly>} />
        <Route path="/brands"
          element={<AdminOnly><CrudPage title="Thương hiệu" endpoint="/admin/brands" fields={brandFields}
            deleteHint="Sản phẩm thuộc thương hiệu này sẽ không còn thương hiệu."
            columns={[{ title: 'Thương hiệu', dataIndex: 'name', render: (name, r) => (<div className="review-product">{r.logo_url ? <img className="review-thumb" style={{ width: 40, height: 40, objectFit: 'contain' }} src={r.logo_url} alt="" /> : <div className="review-thumb review-thumb-empty" style={{ width: 40, height: 40 }}><PictureOutlined /></div>}<Typography.Text strong>{name}</Typography.Text></div>) }, { title: 'Mô tả', dataIndex: 'description', render: (d) => d || <span className="muted-dash">—</span> }]} /></AdminOnly>} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/customers" element={<AdminOnly><Customers /></AdminOnly>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
