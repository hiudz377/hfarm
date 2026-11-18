import { useEffect, useRef, useState } from 'react';
import {
  App, Button, Card, Drawer, Empty, Input, Segmented, Space, Table, Tag, Tooltip,
} from 'antd';
import { HistoryOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
import api, { errMsg } from '../api';
import { dateOnly, dateTime, money, orderTag, PAYMENT_STATUS } from '../utils';
import PageHeader from '../components/PageHeader.jsx';
import ConfirmButton from '../components/ConfirmButton.jsx';
import PersonCell from '../components/PersonCell.jsx';

const STATUS_TAG = { ACTIVE: { text: 'Hoạt động', color: 'green' }, INACTIVE: { text: 'Ngừng', color: 'default' }, BLOCKED: { text: 'Đã khóa', color: 'red' } };

export default function Customers() {
  const { message } = App.useApp();
  const [data, setData] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ type: 'CUSTOMER', status: '', q: '', page: 1, limit: 20 });
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [orderHistory, setOrderHistory] = useState({ data: [], total: 0, page: 1, limit: 10 });
  const [historyLoading, setHistoryLoading] = useState(false);
  const seq = useRef(0);

  const load = async () => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const params = { ...filters, status: filters.status || undefined, q: filters.q || undefined };
      const res = await api.get('/admin/users', { params });
      if (mine === seq.current) setData(res.data);
    } catch (e) { if (mine === seq.current) message.error(errMsg(e)); }
    finally { if (mine === seq.current) setLoading(false); }
  };
  useEffect(() => { load(); }, [filters]);

  const setStatus = async (user, status) => {
    try {
      await api.patch(`/admin/users/${user.id}/status`, { status });
      message.success(status === 'BLOCKED' ? `Đã khóa tài khoản ${user.full_name || user.email}` : `Đã mở khóa tài khoản ${user.full_name || user.email}`);
      load();
    } catch (e) { message.error(errMsg(e)); }
  };

  const openOrderHistory = async (customer, page = 1) => {
    setSelectedCustomer(customer);
    setHistoryLoading(true);
    try {
      setOrderHistory((await api.get(`/admin/users/${customer.id}/orders`, { params: { page, limit: 10 } })).data);
    } catch (error) {
      message.error(`Không tải được lịch sử đơn hàng: ${errMsg(error)}`);
    } finally {
      setHistoryLoading(false);
    }
  };

  const columns = [
    { title: 'Khách hàng', dataIndex: 'full_name', width: 270, render: (name, u) => <PersonCell name={name} sub={u.email} /> },
    { title: 'Số điện thoại', dataIndex: 'phone', width: 130, render: (v) => v || <span className="muted-dash">—</span> },
    { title: 'Đơn hàng', dataIndex: 'order_count', width: 90, align: 'right' },
    {
      title: 'Đã chi tiêu', dataIndex: 'total_spent', width: 130, align: 'right',
      render: (v) => (Number(v) > 0 ? <span className="money-strong">{money(v)}</span> : <span className="muted-dash">—</span>),
    },
    { title: 'Tham gia', dataIndex: 'created_at', width: 110, render: dateOnly },
    {
      title: 'Trạng thái', dataIndex: 'status', width: 110,
      render: (s) => <Tag color={STATUS_TAG[s]?.color} style={{ marginInlineEnd: 0 }}>{STATUS_TAG[s]?.text || s}</Tag>,
    },
    {
      title: 'Thao tác', key: 'actions', width: 100, align: 'right',
      render: (_, user) => (
        <Space size={2}>
          <Tooltip title="Lịch sử đơn hàng">
            <Button type="text" icon={<HistoryOutlined />} aria-label={`Lịch sử đơn hàng của ${user.full_name || user.email}`} onClick={() => openOrderHistory(user)} />
          </Tooltip>
          {user.status === 'BLOCKED' ? (
            <ConfirmButton tip="Mở khóa" confirmTitle="Mở khóa tài khoản này?" okText="Mở khóa" onConfirm={() => setStatus(user, 'ACTIVE')}
              icon={<UnlockOutlined />} aria-label={`Mở khóa ${user.full_name || user.email}`} />
          ) : (
            <ConfirmButton tip="Khóa tài khoản" confirmTitle="Khóa tài khoản này?" description="Khách sẽ không đăng nhập và đặt hàng được nữa."
              okText="Khóa" okDanger onConfirm={() => setStatus(user, 'BLOCKED')}
              icon={<LockOutlined />} aria-label={`Khóa ${user.full_name || user.email}`} />
          )}
        </Space>
      ),
    },
  ];

  const sel = selectedCustomer;
  return (
    <>
      <PageHeader title="Khách hàng" description="Xem thông tin, lịch sử mua hàng và khóa / mở khóa tài khoản khách hàng." />
      <Card className="surface-card">
        <div className="filter-row filter-row-top">
          <Input.Search placeholder="Tên, email hoặc số điện thoại" allowClear style={{ width: 300 }}
            onSearch={(q) => setFilters((c) => ({ ...c, q: q.trim(), page: 1 }))} />
          <Segmented value={filters.status} onChange={(status) => setFilters((c) => ({ ...c, status, page: 1 }))}
            options={[{ value: '', label: 'Tất cả' }, { value: 'ACTIVE', label: 'Hoạt động' }, { value: 'BLOCKED', label: 'Đã khóa' }]} />
          <span className="filter-meta">{data.total} khách hàng</span>
        </div>
        <Table className="data-table" rowKey="id" loading={loading} dataSource={data.data} columns={columns} scroll={{ x: 860 }}
          locale={{ emptyText: <Empty description="Chưa có khách hàng phù hợp" /> }}
          pagination={{
            current: filters.page, pageSize: filters.limit, total: data.total, showSizeChanger: true, pageSizeOptions: [20, 50, 100],
            onChange: (page, limit) => setFilters((c) => ({ ...c, page: limit !== c.limit ? 1 : page, limit })),
          }} />
      </Card>

      <Drawer open={!!sel} onClose={() => setSelectedCustomer(null)} width={760} destroyOnClose title="Lịch sử mua hàng">
        {sel && (
          <>
            <div className="drawer-person">
              <PersonCell name={sel.full_name} sub={sel.email} size={52} />
              <Tag color={STATUS_TAG[sel.status]?.color} style={{ marginInlineStart: 'auto', marginInlineEnd: 0 }}>{STATUS_TAG[sel.status]?.text}</Tag>
            </div>
            <div className="mini-stats">
              <div className="mini-stat"><div className="mini-stat-label">Số điện thoại</div><div className="mini-stat-value" style={{ fontSize: 15 }}>{sel.phone || '—'}</div></div>
              <div className="mini-stat"><div className="mini-stat-label">Số đơn (không tính đơn hủy)</div><div className="mini-stat-value">{sel.order_count}</div></div>
              <div className="mini-stat"><div className="mini-stat-label">Đã chi tiêu</div><div className="mini-stat-value">{money(sel.total_spent)}</div></div>
            </div>
            <Table className="data-table" rowKey="id" size="small" loading={historyLoading} dataSource={orderHistory.data} scroll={{ x: 600 }}
              locale={{ emptyText: <Empty description="Khách hàng chưa có đơn hàng" /> }}
              pagination={{
                current: orderHistory.page, pageSize: orderHistory.limit, total: orderHistory.total, showSizeChanger: false,
                onChange: (page) => openOrderHistory(sel, page),
              }}
              expandable={{
                expandedRowRender: (order) => (
                  <Table rowKey="id" size="small" pagination={false} dataSource={order.items}
                    columns={[
                      { title: 'Sản phẩm', render: (_, item) => `${item.product_name} · ${item.size_name}/${item.color_name}` },
                      { title: 'SKU', dataIndex: 'sku' },
                      { title: 'SL', dataIndex: 'quantity', width: 55 },
                      { title: 'Thành tiền', dataIndex: 'line_total', render: money, width: 130 },
                    ]} />
                ),
              }}
              columns={[
                { title: 'Mã đơn', dataIndex: 'order_code' },
                { title: 'Ngày đặt', dataIndex: 'created_at', render: dateTime },
                { title: 'Tổng tiền', dataIndex: 'total_amount', align: 'right', render: (v) => <span className="money-strong">{money(v)}</span> },
                { title: 'Thanh toán', dataIndex: 'payment_status', render: (status) => PAYMENT_STATUS[status] || status },
                { title: 'Trạng thái', dataIndex: 'status', render: (status) => <Tag color={orderTag(status)?.color || 'default'} style={{ marginInlineEnd: 0 }}>{orderTag(status)?.text || status}</Tag> },
              ]} />
          </>
        )}
      </Drawer>
    </>
  );
}
