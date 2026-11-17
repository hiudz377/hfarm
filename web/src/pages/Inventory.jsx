import { useEffect, useState } from 'react';
import {
  App, Avatar, Button, Card, Col, Descriptions, Drawer, Empty, Form, Image, Input, InputNumber,
  Modal, Radio, Row, Space, Statistic, Table, Tag, Tooltip, Typography,
} from 'antd';
import { HistoryOutlined, InboxOutlined } from '@ant-design/icons';
import api, { errMsg } from '../api';
import PageHeader from '../components/PageHeader.jsx';
import { dateTime, money } from '../utils';

const movementNames = {
  IMPORT: 'Nhập kho',
  EXPORT: 'Xuất kho',
  ADJUSTMENT: 'Điều chỉnh',
  ORDER_DEDUCT: 'Trừ theo đơn hàng',
  ORDER_RESTOCK: 'Hoàn kho',
};

function StockTag({ quantity }) {
  const color = quantity === 0 ? 'red' : quantity <= 5 ? 'orange' : 'green';
  return <Tag color={color}>{quantity}</Tag>;
}

export default function Inventory() {
  const { message } = App.useApp();
  const [result, setResult] = useState({ data: [], total: 0, stats: {} });
  const [filters, setFilters] = useState({ q: '', low: '', out: '', page: 1, limit: 10 });
  const [loading, setLoading] = useState(false);
  const [stockItem, setStockItem] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);
  const [movements, setMovements] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const params = { q: filters.q, page: filters.page, limit: filters.limit };
      if (filters.low) params.low = '1';
      if (filters.out) params.out = '1';
      setResult((await api.get('/admin/inventory', { params })).data);
    } catch (e) {
      message.error(`Không tải được dữ liệu kho: ${errMsg(e)}`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [filters]);

  const openStock = (item) => {
    form.resetFields();
    form.setFieldsValue({ type: 'IMPORT', quantity: 1 });
    setStockItem(item);
  };

  const saveStock = async () => {
    const values = await form.validateFields();
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

  return (
    <>
      <PageHeader title="Kho hàng" description="Theo dõi tồn kho và lịch sử nhập, xuất của từng biến thể." />
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}><Card className="surface-card"><Statistic title="Tổng số biến thể" value={result.stats.variants ?? 0} /></Card></Col>
        <Col xs={24} sm={8}><Card className="surface-card"><Statistic title="Sắp hết hàng (≤ 5)" value={result.stats.low_stock ?? 0} valueStyle={{ color: '#d48806' }} /></Card></Col>
        <Col xs={24} sm={8}><Card className="surface-card"><Statistic title="Hết hàng" value={result.stats.out_of_stock ?? 0} valueStyle={{ color: '#cf1322' }} /></Card></Col>
      </Row>

      <Card className="surface-card">
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
          <Input.Search
            placeholder="Tìm tên sản phẩm hoặc SKU"
            allowClear
            style={{ width: 300, maxWidth: '100%' }}
            onSearch={(q) => setFilters((current) => ({ ...current, q, page: 1 }))}
          />
          <Radio.Group
            value={filters.low ? 'low' : filters.out ? 'out' : 'all'}
            optionType="button"
            buttonStyle="solid"
            options={[
              { label: 'Tất cả', value: 'all' },
              { label: 'Sắp hết', value: 'low' },
              { label: 'Hết hàng', value: 'out' },
            ]}
            onChange={({ target: { value } }) => setFilters((current) => ({
              ...current, low: value === 'low', out: value === 'out', page: 1,
            }))}
          />
        </Space>
        <Table
          className="data-table"
          rowKey="variant_id"
          loading={loading}
          dataSource={result.data}
          scroll={{ x: 900 }}
          pagination={{
            current: filters.page, pageSize: filters.limit, total: result.total,
            showSizeChanger: false, onChange: (page) => setFilters((current) => ({ ...current, page })),
          }}
          locale={{ emptyText: <Empty description="Chưa có biến thể phù hợp" /> }}
          columns={[
            { title: 'Sản phẩm', dataIndex: 'product_name', render: (name, item) => (
              <Space>
                {item.thumbnail
                  ? <Image src={item.thumbnail} width={42} height={52} style={{ objectFit: 'cover', borderRadius: 6 }} />
                  : <Avatar shape="square" icon={<InboxOutlined />} />}
                <Typography.Text strong>{name}</Typography.Text>
              </Space>
            ) },
            { title: 'SKU', dataIndex: 'sku' },
            { title: 'Size', dataIndex: 'size_name' },
            { title: 'Màu', dataIndex: 'color_name' },
            { title: 'Giá bán', dataIndex: 'price', render: money },
            { title: 'Tồn kho', dataIndex: 'stock_quantity', width: 100, render: (quantity) => <StockTag quantity={quantity} /> },
            { title: 'Trạng thái', dataIndex: 'is_active', render: (active) => (
              <Tag color={active ? 'green' : 'default'}>{active ? 'Đang bán' : 'Ngừng bán'}</Tag>
            ) },
            { title: 'Thao tác', width: 110, fixed: 'right', render: (_, item) => (
              <Space className="table-actions" size={4}>
                <Tooltip title="Nhập / xuất kho">
                  <Button type="text" icon={<InboxOutlined />} aria-label="Nhập xuất kho" onClick={() => openStock(item)} />
                </Tooltip>
                <Tooltip title="Lịch sử kho">
                  <Button type="text" icon={<HistoryOutlined />} aria-label="Lịch sử kho" onClick={() => openHistory(item)} />
                </Tooltip>
              </Space>
            ) },
          ]}
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
