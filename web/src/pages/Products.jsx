import { useEffect, useRef, useState } from 'react';
import { App, Button, Card, Empty, Input, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { CheckCircleOutlined, EditOutlined, PauseCircleOutlined, PictureOutlined, PlusOutlined, StarFilled } from '@ant-design/icons';
import api, { errMsg } from '../api';
import { money, OUTFIT_ROLES, PRODUCT_STATUS } from '../utils';
import ProductDrawer from './ProductDrawer.jsx';
import PageHeader from '../components/PageHeader.jsx';
import ConfirmButton from '../components/ConfirmButton.jsx';

// Tồn kho: hết hàng đỏ, sắp hết (≤ 5) cam, còn nhiều xanh
function StockTag({ value }) {
  const n = Number(value) || 0;
  if (n === 0) return <Tag color="red" style={{ marginInlineEnd: 0 }}>Hết hàng</Tag>;
  return <Tag color={n <= 5 ? 'orange' : 'green'} style={{ marginInlineEnd: 0 }}>{n} {n <= 5 ? '· sắp hết' : ''}</Tag>;
}

export default function Products() {
  const { message } = App.useApp();
  const [data, setData] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ q: '', status: undefined, category_id: undefined, brand_id: undefined, page: 1, limit: 20 });
  const [meta, setMeta] = useState({ categories: [], brands: [] });
  const [drawer, setDrawer] = useState({ open: false, id: null });
  const seq = useRef(0);

  const load = async () => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const res = await api.get('/admin/products', { params: filters });
      if (mine === seq.current) setData(res.data);
    } catch (e) { if (mine === seq.current) message.error(errMsg(e)); }
    finally { if (mine === seq.current) setLoading(false); }
  };
  useEffect(() => { load(); }, [filters]);
  useEffect(() => {
    Promise.all([api.get('/admin/categories'), api.get('/admin/brands')])
      .then(([categories, brands]) => setMeta({ categories: categories.data, brands: brands.data }))
      .catch((error) => message.error(`Không tải được bộ lọc sản phẩm: ${errMsg(error)}`));
  }, []);

  const set = (patch) => setFilters((current) => ({ ...current, ...patch, page: 1 }));

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

  const columns = [
    {
      title: 'Sản phẩm', dataIndex: 'name', width: 340,
      render: (name, r) => (
        <div className="review-product">
          {r.thumbnail
            ? <img className="review-thumb" src={r.thumbnail} alt="" />
            : <div className="review-thumb review-thumb-empty"><PictureOutlined /></div>}
          <div>
            <Typography.Text strong>{name}</Typography.Text>
            <div className="cell-sub">{[r.brand_name, r.category_name].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Giá từ', dataIndex: 'min_price', align: 'right', width: 150,
      render: (v, r) => {
        const price = v ?? r.base_price;
        const compare = Number(r.compare_at_price) > Number(price) ? Number(r.compare_at_price) : null;
        return (
          <div>
            <Typography.Text strong>{money(price)}</Typography.Text>
            {compare && <div className="cell-sub"><s>{money(compare)}</s></div>}
          </div>
        );
      },
    },
    { title: 'Tồn kho', dataIndex: 'total_stock', width: 130, render: (v) => <StockTag value={v} /> },
    {
      // Stylist chỉ phối những sản phẩm đã gắn vai trò: cho nhân viên thấy sản phẩm nào còn thiếu thẻ
      title: 'Phối đồ', dataIndex: 'outfit_role', width: 130,
      render: (role) => (role
        ? <Tag color="blue" style={{ marginInlineEnd: 0 }}>{OUTFIT_ROLES[role] ?? role}</Tag>
        : <Tooltip title="Chưa gắn thẻ nên chưa xuất hiện trong gợi ý bộ đồ. Mở sản phẩm, mục Gợi ý bộ đồ (Stylist)."><Tag style={{ marginInlineEnd: 0 }}>Chưa gắn thẻ</Tag></Tooltip>),
    },
    {
      title: 'Đánh giá', dataIndex: 'rating_avg', width: 130,
      render: (v, r) => (Number(r.rating_count) > 0
        ? <span><StarFilled className="rating-star" /> {Number(v).toFixed(1)} <span className="cell-sub-inline">({r.rating_count})</span></span>
        : <span className="cell-sub-inline">Chưa có</span>),
    },
    {
      title: 'Trạng thái', dataIndex: 'status', width: 120,
      render: (s) => <Tag color={PRODUCT_STATUS[s].color} style={{ marginInlineEnd: 0 }}>{PRODUCT_STATUS[s].text}</Tag>,
    },
    {
      title: 'Thao tác', key: 'actions', width: 110, align: 'right', fixed: 'right',
      render: (_, r) => (
        <Space size={2}>
          <Tooltip title="Chỉnh sửa">
            <Button type="text" icon={<EditOutlined />} aria-label={`Chỉnh sửa ${r.name}`}
              onClick={() => setDrawer({ open: true, id: r.id })} />
          </Tooltip>
          <ConfirmButton
            tip={r.status === 'ACTIVE' ? 'Ngừng bán' : 'Mở bán'}
            confirmTitle={r.status === 'ACTIVE' ? 'Ngừng bán sản phẩm này?' : 'Mở bán sản phẩm này?'}
            okText={r.status === 'ACTIVE' ? 'Ngừng bán' : 'Mở bán'}
            okDanger={r.status === 'ACTIVE'}
            onConfirm={() => toggleProduct(r)}
            danger={r.status === 'ACTIVE'}
            aria-label={`${r.status === 'ACTIVE' ? 'Ngừng bán' : 'Mở bán'} ${r.name}`}
            icon={r.status === 'ACTIVE' ? <PauseCircleOutlined /> : <CheckCircleOutlined />}
          />
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Sản phẩm" description="Quản lý thông tin, mẫu mã và trạng thái kinh doanh."
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawer({ open: true, id: null })}>Thêm sản phẩm</Button>} />

      <Card className="surface-card">
        <div className="filter-row filter-row-top">
          <Input.Search placeholder="Tìm theo tên sản phẩm" allowClear style={{ width: 280 }}
            onSearch={(q) => set({ q: q.trim() })} />
          <Select placeholder="Trạng thái" allowClear style={{ width: 150 }} value={filters.status}
            options={Object.entries(PRODUCT_STATUS).map(([value, v]) => ({ value, label: v.text }))}
            onChange={(status) => set({ status })} />
          <Select placeholder="Danh mục" allowClear style={{ width: 170 }} value={filters.category_id}
            options={meta.categories.map((category) => ({ value: category.id, label: category.name }))}
            onChange={(category_id) => set({ category_id })} />
          <Select placeholder="Thương hiệu" allowClear style={{ width: 170 }} value={filters.brand_id}
            options={meta.brands.map((brand) => ({ value: brand.id, label: brand.name }))}
            onChange={(brand_id) => set({ brand_id })} />
        </div>
        <Table className="data-table" rowKey="id" loading={loading} dataSource={data.data} columns={columns}
          scroll={{ x: 900 }}
          locale={{ emptyText: <Empty description="Chưa có sản phẩm phù hợp" /> }}
          pagination={{
            current: filters.page, pageSize: filters.limit, total: data.total, showSizeChanger: true,
            pageSizeOptions: [20, 50, 100], showTotal: (t) => `${t} sản phẩm`,
            onChange: (page, limit) => setFilters((current) => ({ ...current, page: limit !== current.limit ? 1 : page, limit })),
          }} />
      </Card>

      <ProductDrawer open={drawer.open} productId={drawer.id}
        onClose={() => setDrawer({ open: false, id: null })} onChanged={load} />
    </>
  );
}
