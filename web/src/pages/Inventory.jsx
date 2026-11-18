import { useEffect, useRef, useState } from 'react';
import {
  App, Button, Card, Col, Descriptions, Drawer, Empty, Form, Input, InputNumber,
  Modal, Radio, Row, Space, Table, Tag, Tooltip, Typography,
} from 'antd';
import {
  AppstoreOutlined, CloseCircleOutlined, HistoryOutlined, InboxOutlined, PictureOutlined, WarningOutlined,
} from '@ant-design/icons';
import api, { errMsg } from '../api';
import PageHeader from '../components/PageHeader.jsx';
import { dateTime, money, validate } from '../utils';

const movementNames = {
  IMPORT: 'Nhập kho',
  EXPORT: 'Xuất kho',
  ADJUSTMENT: 'Điều chỉnh',
  ORDER_DEDUCT: 'Trừ theo đơn hàng',
  ORDER_RESTOCK: 'Hoàn kho',
};

function StockTag({ quantity }) {
  if (quantity === 0) return <Tag color="red" style={{ marginInlineEnd: 0 }}>Hết hàng</Tag>;
  return <Tag color={quantity <= 5 ? 'orange' : 'green'} style={{ marginInlineEnd: 0 }}>{quantity}{quantity <= 5 ? ' · sắp hết' : ''}</Tag>;
}

export default function Inventory() {
  const { message } = App.useApp();
  const [result, setResult] = useState({ data: [], total: 0, stats: {} });
  const [filters, setFilters] = useState({ q: '', low: '', out: '', page: 1, limit: 20 });
  const [loading, setLoading] = useState(false);
  const [stockItem, setStockItem] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);
  const [movements, setMovements] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [form] = Form.useForm();
  const seq = useRef(0);

  const load = async () => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const params = { q: filters.q, page: filters.page, limit: filters.limit };
      if (filters.low) params.low = '1';
      if (filters.out) params.out = '1';
      const res = await api.get('/admin/inventory', { params });
      if (mine === seq.current) setResult(res.data);
    } catch (e) {
      if (mine === seq.current) message.error(`Không tải được dữ liệu kho: ${errMsg(e)}`);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  };
  useEffect(() => { load(); }, [filters]);

  const mode = filters.low ? 'low' : filters.out ? 'out' : 'all';
  const setMode = (value) => setFilters((current) => ({ ...current, low: value === 'low', out: value === 'out', page: 1 }));

  const openStock = (item) => {
    form.resetFields();
    form.setFieldsValue({ type: 'IMPORT', quantity: 1 });
    setStockItem(item);
  };

  const saveStock = async () => {
    const values = await validate(form);
    if (!values) return;
    try {
      await api.post(`/admin/products/variants/${stockItem.variant_id}/stock`, values);
      message.success('Đã cập nhật tồn kho');
      setStockItem(null);
      load();
    } catch (e) {
      message.error(`Không cập nhật được tồn kho: ${errMsg(e)}`);
    }
  };

  const openHistory = async (item) => {
    setHistoryItem(item);
    setMovements([]);
    setHistoryLoading(true);
    try {
      setMovements((await api.get(`/admin/products/variants/${item.variant_id}/movements`)).data);
    } catch (e) {
      message.error(`Không tải được lịch sử kho: ${errMsg(e)}`);
    } finally {
      setHistoryLoading(false);
    }
  };

  const kpis = [
    { key: 'all', label: 'Tổng số biến thể', value: result.stats.variants ?? 0, icon: <AppstoreOutlined />, tone: 'blue' },
    { key: 'low', label: 'Sắp hết hàng (≤ 5)', value: result.stats.low_stock ?? 0, icon: <WarningOutlined />, tone: 'orange' },
    { key: 'out', label: 'Hết hàng', value: result.stats.out_of_stock ?? 0, icon: <CloseCircleOutlined />, tone: 'red' },
  ];

  const columns = [
    {
      title: 'Sản phẩm', dataIndex: 'product_name', width: 320,
      render: (name, item) => (
        <div className="review-product">
          {item.thumbnail
            ? <img className="review-thumb" src={item.thumbnail} alt="" />
            : <div className="review-thumb review-thumb-empty"><PictureOutlined /></div>}
          <div>
            <Typography.Text strong>{name}</Typography.Text>
            <div className="cell-sub coupon-code">{item.sku}</div>
          </div>
        </div>
      ),
    },
    { title: 'Phiên bản', width: 150, render: (_, item) => <span>{item.size_name} · {item.color_name}</span> },
    { title: 'Giá bán', dataIndex: 'price', align: 'right', width: 130, render: (v) => <span className="money-strong">{money(v)}</span> },
    { title: 'Tồn kho', dataIndex: 'stock_quantity', width: 130, render: (quantity) => <StockTag quantity={quantity} /> },
    {
      title: 'Trạng thái', dataIndex: 'is_active', width: 120,
      render: (active) => <Tag color={active ? 'green' : 'default'} style={{ marginInlineEnd: 0 }}>{active ? 'Đang bán' : 'Ngừng bán'}</Tag>,
    },
    {
      title: 'Thao tác', key: 'actions', width: 110, fixed: 'right', align: 'right',
      render: (_, item) => (
        <Space className="table-actions" size={2}>
          <Tooltip title="Nhập / xuất kho">
            <Button type="text" icon={<InboxOutlined />} aria-label={`Nhập xuất kho ${item.sku}`} onClick={() => openStock(item)} />
          </Tooltip>
          <Tooltip title="Lịch sử kho">
            <Button type="text" icon={<HistoryOutlined />} aria-label={`Lịch sử kho ${item.sku}`} onClick={() => openHistory(item)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Kho hàng" description="Theo dõi tồn kho và lịch sử nhập, xuất của từng biến thể." />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {kpis.map((k) => (
          <Col xs={24} sm={8} key={k.key}>
            <Card className={`surface-card kpi-card${mode === k.key ? ' active' : ''}`} hoverable onClick={() => setMode(k.key)}
              role="button" aria-label={`Lọc: ${k.label}`}>
              <div className="todo-body">
                <span className={`stat-icon stat-${k.tone}`}>{k.icon}</span>
                <div className="todo-text">
                  <div className="todo-count">{k.value}</div>
                  <div className="todo-label">{k.label}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card className="surface-card">
        <div className="filter-row filter-row-top">
          <Input.Search
            placeholder="Tìm tên sản phẩm hoặc SKU"
            allowClear
            style={{ width: 300, maxWidth: '100%' }}
            onSearch={(q) => setFilters((current) => ({ ...current, q: q.trim(), page: 1 }))}
          />
          <Radio.Group
            value={mode}
            optionType="button"
            buttonStyle="solid"
            options={[
              { label: 'Tất cả', value: 'all' },
              { label: 'Sắp hết', value: 'low' },
              { label: 'Hết hàng', value: 'out' },
            ]}
            onChange={({ target: { value } }) => setMode(value)}
          />
          <span className="filter-meta">{result.total} biến thể</span>
        </div>
        <Table
          className="data-table"
          rowKey="variant_id"
          loading={loading}
          dataSource={result.data}
          columns={columns}
          scroll={{ x: 900 }}
          pagination={{
            current: filters.page, pageSize: filters.limit, total: result.total, showSizeChanger: true, pageSizeOptions: [20, 50, 100],
            onChange: (page, limit) => setFilters((current) => ({ ...current, page: limit !== current.limit ? 1 : page, limit })),
          }}
          locale={{ emptyText: <Empty description="Chưa có biến thể phù hợp" /> }}
        />
      </Card>

      <Modal
        open={!!stockItem}
        title={`Cập nhật kho · ${stockItem?.sku || ''}`}
        okText="Cập nhật"
        cancelText="Hủy"
        onOk={saveStock}
        onCancel={() => setStockItem(null)}
        destroyOnHidden
        forceRender
      >
        {stockItem && <Typography.Paragraph type="secondary">
          {stockItem.product_name} · {stockItem.size_name} / {stockItem.color_name} · Hiện có {stockItem.stock_quantity}
        </Typography.Paragraph>}
        <Form form={form} layout="vertical">
          <Form.Item name="type" label="Thao tác">
            <Radio.Group options={[
              { value: 'IMPORT', label: 'Nhập thêm' },
              { value: 'EXPORT', label: 'Xuất bớt' },
              { value: 'ADJUSTMENT', label: 'Đặt lại số lượng' },
            ]} />
          </Form.Item>
          <Form.Item name="quantity" label="Số lượng" rules={[
            { required: true, message: 'Vui lòng nhập số lượng' },
            { type: 'number', min: 0, message: 'Số lượng không được âm' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (getFieldValue('type') === 'ADJUSTMENT' || Number(value) >= 1) return Promise.resolve();
                return Promise.reject(new Error('Nhập/xuất cần số lượng từ 1 trở lên'));
              },
            }),
          ]}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        open={!!historyItem}
        onClose={() => setHistoryItem(null)}
        width={720}
        title="Lịch sử kho"
        destroyOnClose
      >
        {historyItem && <Descriptions size="small" column={1} style={{ marginBottom: 18 }}>
          <Descriptions.Item label="Sản phẩm">{historyItem.product_name}</Descriptions.Item>
          <Descriptions.Item label="Biến thể">{historyItem.sku} · {historyItem.size_name} / {historyItem.color_name}</Descriptions.Item>
          <Descriptions.Item label="Tồn hiện tại"><StockTag quantity={historyItem.stock_quantity} /></Descriptions.Item>
        </Descriptions>}
        <Table
          className="data-table"
          rowKey="id"
          size="small"
          loading={historyLoading}
          dataSource={movements}
          pagination={false}
          scroll={{ x: 700 }}
          locale={{ emptyText: <Empty description="Chưa có lịch sử kho" /> }}
          columns={[
            { title: 'Loại', dataIndex: 'movement_type', render: (type) => movementNames[type] || type },
            { title: 'Thay đổi', dataIndex: 'quantity_change', render: (value) => (
              <Typography.Text type={value < 0 ? 'danger' : 'success'}>
                {value > 0 ? '+' : ''}{value}
              </Typography.Text>
            ) },
            { title: 'Trước → Sau', render: (_, row) => `${row.quantity_before} → ${row.quantity_after}` },
            { title: 'Người thực hiện', dataIndex: 'created_by_name', render: (name) => name || 'Hệ thống' },
            { title: 'Ghi chú', dataIndex: 'note', render: (note) => note || '—' },
            { title: 'Thời gian', dataIndex: 'created_at', render: dateTime },
          ]}
        />
      </Drawer>
    </>
  );
}
