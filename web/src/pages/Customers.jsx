import { useEffect, useState } from 'react';
import {
  App, Button, Card, Descriptions, Drawer, Empty, Input, Switch, Table, Tag, Tooltip,
} from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import api, { errMsg } from '../api';
import { dateTime, money, ORDER_STATUS, PAYMENT_STATUS } from '../utils';
import PageHeader from '../components/PageHeader.jsx';

export default function Customers() {
  const { message } = App.useApp();
  const [data, setData] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ type: 'CUSTOMER', q: '', page: 1, limit: 10 });
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [orderHistory, setOrderHistory] = useState({ data: [], total: 0, page: 1, limit: 10 });
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setData((await api.get('/admin/users', { params: filters })).data); }
    catch (e) { message.error(errMsg(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [filters]);

  const toggleBlock = async (user, blocked) => {
    try {
      await api.patch(`/admin/users/${user.id}/status`, { status: blocked ? 'BLOCKED' : 'ACTIVE' });
      load();
    } catch (e) { message.error(errMsg(e)); }
  };

  const openOrderHistory = async (customer, page = 1) => {
    setSelectedCustomer(customer);
    setHistoryLoading(true);
    try {
      setOrderHistory((await api.get(`/admin/users/${customer.id}/orders`, {
        params: { page, limit: 10 },
      })).data);
    } catch (error) {
      message.error(`Không tải được lịch sử đơn hàng: ${errMsg(error)}`);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <>
      <PageHeader title="Khách hàng" description="Xem thông tin và tình trạng tài khoản khách hàng."
        extra={<Input.Search placeholder="Tên, email, SĐT" allowClear style={{ width: 260 }}
          onSearch={(q) => setFilters((current) => ({ ...current, q, page: 1 }))} />} />
      <Card className="surface-card">
      <Table className="data-table" rowKey="id" loading={loading} dataSource={data.data}
        locale={{ emptyText: <Empty description="Chưa có khách hàng phù hợp" /> }}
        pagination={{ current: filters.page, pageSize: filters.limit, total: data.total, showSizeChanger: false,
          onChange: (page) => setFilters((current) => ({ ...current, page })) }}
        columns={[
          { title: 'Họ tên', dataIndex: 'full_name' },
          { title: 'Email', dataIndex: 'email' },
          { title: 'SĐT', dataIndex: 'phone' },
          { title: 'Số đơn', dataIndex: 'order_count' },
          { title: 'Đã chi tiêu', dataIndex: 'total_spent', render: money },
          { title: 'Ngày tạo', dataIndex: 'created_at', render: dateTime },
          { title: 'Trạng thái', dataIndex: 'status',
            render: (s) => <Tag color={s === 'ACTIVE' ? 'green' : 'red'}>{s === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}</Tag> },
          { title: 'Khóa', render: (_, u) => (
            <Switch size="small" checked={u.status === 'BLOCKED'} onChange={(c) => toggleBlock(u, c)} />
          ) },
          { title: '', width: 70, render: (_, user) => (
            <Tooltip title="Lịch sử đơn hàng">
              <Button type="text" icon={<HistoryOutlined />} aria-label="Lịch sử đơn hàng"
                onClick={() => openOrderHistory(user)} />
            </Tooltip>
          ) },
        ]} />
      </Card>
      <Drawer
        open={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        width={760}
        title={`Lịch sử đơn hàng · ${selectedCustomer?.full_name || selectedCustomer?.email || ''}`}
        destroyOnClose
      >
        {selectedCustomer && (
          <>
            <Descriptions size="small" column={1} style={{ marginBottom: 18 }}>
              <Descriptions.Item label="Email">{selectedCustomer.email}</Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">{selectedCustomer.phone || '—'}</Descriptions.Item>
            </Descriptions>
            <Table
              className="data-table"
              rowKey="id"
              size="small"
              loading={historyLoading}
              dataSource={orderHistory.data}
              scroll={{ x: 600 }}
              locale={{ emptyText: <Empty description="Khách hàng chưa có đơn hàng" /> }}
              pagination={{
                current: orderHistory.page,
                pageSize: orderHistory.limit,
                total: orderHistory.total,
                showSizeChanger: false,
                onChange: (page) => openOrderHistory(selectedCustomer, page),
              }}
              expandable={{
                expandedRowRender: (order) => (
                  <Table
                    rowKey="id"
                    size="small"
                    pagination={false}
                    dataSource={order.items}
                    columns={[
                      { title: 'Sản phẩm', render: (_, item) => `${item.product_name} · ${item.size_name}/${item.color_name}` },
                      { title: 'SKU', dataIndex: 'sku' },
                      { title: 'SL', dataIndex: 'quantity', width: 55 },
                      { title: 'Thành tiền', dataIndex: 'line_total', render: money, width: 130 },
                    ]}
                  />
                ),
              }}
              columns={[
                { title: 'Mã đơn', dataIndex: 'order_code' },
                { title: 'Ngày đặt', dataIndex: 'created_at', render: dateTime },
                { title: 'Tổng tiền', dataIndex: 'total_amount', render: money },
                { title: 'Thanh toán', dataIndex: 'payment_status',
                  render: (status) => PAYMENT_STATUS[status] || status },
                { title: 'Trạng thái', dataIndex: 'status', render: (status) => (
                  <Tag color={ORDER_STATUS[status]?.color || 'default'}>{ORDER_STATUS[status]?.text || status}</Tag>
                ) },
              ]}
            />
          </>
        )}
      </Drawer>
    </>
  );
}
