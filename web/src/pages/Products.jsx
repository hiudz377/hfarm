import { useEffect, useState } from 'react';
import {
  App, Button, Card, Empty, Image, Input, Popconfirm, Select, Space, Table, Tag, Tooltip,
} from 'antd';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import api, { errMsg } from '../api';
import { money, PRODUCT_STATUS } from '../utils';
import ProductDrawer from './ProductDrawer.jsx';
import PageHeader from '../components/PageHeader.jsx';

export default function Products() {
  const { message } = App.useApp();
  const [data, setData] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ q: '', status: undefined, page: 1, limit: 10 });
  const [meta, setMeta] = useState({ categories: [], brands: [] });
  const [drawer, setDrawer] = useState({ open: false, id: null });

  const load = async () => {
    setLoading(true);
    try { setData((await api.get('/admin/products', { params: filters })).data); }
    catch (e) { message.error(errMsg(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [filters]);
  useEffect(() => {
    Promise.all([api.get('/admin/categories'), api.get('/admin/brands')])
      .then(([categories, brands]) => setMeta({ categories: categories.data, brands: brands.data }))
      .catch((error) => message.error(`Không tải được bộ lọc sản phẩm: ${errMsg(error)}`));
  }, []);

  const toggleProduct = async (product) => {
    try {
      if (product.status === 'ACTIVE') {
        await api.delete(`/admin/products/${product.id}`);
        message.success('Đã ngừng bán sản phẩm');
      } else {
        await api.put(`/admin/products/${product.id}`, { status: 'ACTIVE' });
        message.success('Đã mở bán sản phẩm');
      }
      load();
    } catch (error) {
      message.error(`Không cập nhật được sản phẩm: ${errMsg(error)}`);
    }
  };

  return (
    <>
      <PageHeader title="Sản phẩm" description="Quản lý thông tin, biến thể và trạng thái kinh doanh."
        extra={<Space wrap>
          <Input.Search placeholder="Tìm theo tên" allowClear style={{ width: 220 }}
            onSearch={(q) => setFilters((current) => ({ ...current, q, page: 1 }))} />
          <Select placeholder="Trạng thái" allowClear style={{ width: 140 }}
            options={Object.entries(PRODUCT_STATUS).map(([value, v]) => ({ value, label: v.text }))}
            onChange={(status) => setFilters((current) => ({ ...current, status, page: 1 }))} />
          <Select placeholder="Danh mục" allowClear style={{ width: 160 }}
            options={meta.categories.map((category) => ({ value: category.id, label: category.name }))}
            onChange={(category_id) => setFilters((current) => ({ ...current, category_id, page: 1 }))} />
          <Select placeholder="Thương hiệu" allowClear style={{ width: 160 }}
            options={meta.brands.map((brand) => ({ value: brand.id, label: brand.name }))}
            onChange={(brand_id) => setFilters((current) => ({ ...current, brand_id, page: 1 }))} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawer({ open: true, id: null })}>
            Thêm sản phẩm
          </Button>
        </Space>} />

      <Card className="surface-card">
      <Table className="data-table" rowKey="id" loading={loading} dataSource={data.data}
        locale={{ emptyText: <Empty description="Chưa có sản phẩm phù hợp" /> }}
        pagination={{ current: filters.page, pageSize: filters.limit, total: data.total, showSizeChanger: false,
          onChange: (page) => setFilters((current) => ({ ...current, page })) }}
        columns={[
          { title: 'Ảnh', dataIndex: 'thumbnail', width: 80,
            render: (u) => (u ? <Image src={u} width={48} height={64} style={{ objectFit: 'cover' }} /> : '—') },
          { title: 'Tên sản phẩm', dataIndex: 'name' },
          { title: 'Danh mục', dataIndex: 'category_name' },
          { title: 'Thương hiệu', dataIndex: 'brand_name' },
          { title: 'Giá từ', dataIndex: 'min_price', render: (v, r) => money(v ?? r.base_price) },
          { title: 'Tồn kho', dataIndex: 'total_stock' },
          { title: 'Trạng thái', dataIndex: 'status',
            render: (s) => <Tag color={PRODUCT_STATUS[s].color}>{PRODUCT_STATUS[s].text}</Tag> },
          { title: 'Thao tác', width: 150, render: (_, r) => (
            <Space size={2}>
              <Tooltip title="Chỉnh sửa">
                <Button type="text" icon={<EditOutlined />} aria-label="Chỉnh sửa"
                  onClick={() => setDrawer({ open: true, id: r.id })} />
              </Tooltip>
              <Popconfirm
                title={r.status === 'ACTIVE' ? 'Ngừng bán sản phẩm này?' : 'Mở bán sản phẩm này?'}
                okText={r.status === 'ACTIVE' ? 'Ngừng bán' : 'Mở bán'}
                cancelText="Hủy"
                okButtonProps={r.status === 'ACTIVE' ? { danger: true } : {}}
                onConfirm={() => toggleProduct(r)}
              >
                <Button type="link" danger={r.status === 'ACTIVE'}>
                  {r.status === 'ACTIVE' ? 'Ngừng bán' : 'Mở bán'}
                </Button>
              </Popconfirm>
            </Space>
          ) },
        ]} />
      </Card>

      <ProductDrawer open={drawer.open} productId={drawer.id}
        onClose={() => setDrawer({ open: false, id: null })} onChanged={load} />
    </>
  );
}
