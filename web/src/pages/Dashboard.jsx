import { useEffect, useState } from 'react';
import {
  App, Button, Card, Col, Empty, Row, Select, Statistic, Table, Tag,
} from 'antd';
import {
  CheckCircleOutlined, DollarCircleOutlined, RightOutlined, ShoppingOutlined, StarOutlined, TeamOutlined, WarningOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import {
  Area, AreaChart, Cell, CartesianGrid, Legend, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import api, { errMsg } from '../api';
import { dateTime, money, ORDER_STATUS, orderTag } from '../utils';
import PageHeader from '../components/PageHeader.jsx';

// Màu biểu đồ trạng thái đơn khớp với màu nhãn trạng thái ở trang Đơn hàng
const STATUS_COLORS = {
  PENDING: '#F9A825', CONFIRMED: '#1976D2', PROCESSING: '#00ACC1', SHIPPING: '#8E24AA',
  COMPLETED: '#2E7D32', CANCELLED: '#E53935', RETURNED: '#FB8C00',
};
const COMPACT_MONEY = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 });

function dateLabel(date) {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
}

export default function Dashboard() {
  const { message } = App.useApp();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [days, setDays] = useState(30);
  const [revenue, setRevenue] = useState([]);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const navigate = useNavigate();
  const [todo, setTodo] = useState(null); // { pendingOrders, pendingReviews } hoặc null khi chưa tải được
  const [recent, setRecent] = useState([]);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try { setStats((await api.get('/admin/stats')).data); }
    catch (e) {
      setLoadError(`Không tải được dữ liệu tổng quan: ${errMsg(e)}`);
      message.error(`Không tải được dữ liệu tổng quan: ${errMsg(e)}`);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Việc cần xử lý + đơn gần đây: lỗi thì bỏ qua (chỉ là phần phụ của trang tổng quan)
  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/admin/orders/counts'),
      api.get('/admin/reviews/counts'),
      api.get('/admin/orders', { params: { limit: 6, page: 1 } }),
    ]).then(([orders, reviews, list]) => {
      if (!active) return;
      setTodo({ pendingOrders: orders.data.PENDING, pendingReviews: reviews.data.PENDING });
      setRecent(list.data.data);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setRevenueLoading(true);
    api.get('/admin/stats/revenue', { params: { days } })
      .then((response) => { if (active) setRevenue(response.data.data); })
      .catch((error) => {
        if (active) {
          setRevenue([]);
          message.error(`Không tải được biểu đồ doanh thu: ${errMsg(error)}`);
        }
      })
      .finally(() => { if (active) setRevenueLoading(false); });
    return () => { active = false; };
  }, [days]);

  if (!stats) return (
    <>
      <PageHeader title="Tổng quan" description="Tình hình hoạt động cửa hàng." />
      <Card loading={loading}>
        {!loading && <Empty description={loadError || 'Chưa có dữ liệu'}>
          <Button type="primary" onClick={load}>Thử lại</Button>
        </Empty>}
      </Card>
    </>
  );

  const orderChart = stats.orders_by_status
    .filter((row) => Number(row.count) > 0)
    .map((row) => ({ key: row.status, status: ORDER_STATUS[row.status]?.text || row.status, count: Number(row.count) }));

  // Số liệu phụ dưới thẻ doanh thu: lấy từ chuỗi doanh thu theo ngày đã tải (ngày cuối = hôm nay)
  const today = revenue.length ? revenue[revenue.length - 1] : null;
  const last7 = revenue.slice(-7);
  const week = { revenue: last7.reduce((a, r) => a + Number(r.revenue), 0), orders: last7.reduce((a, r) => a + Number(r.order_count), 0) };
  const lowCount = (stats.low_stock || []).length;

  return (
    <>
      <PageHeader title="Tổng quan" description="Tình hình hoạt động cửa hàng." />
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card className="surface-card"><Statistic title="Doanh thu (đơn hoàn thành)"
            value={money(stats.revenue)} prefix={<DollarCircleOutlined className="stat-icon stat-green" />} />
            <div className="kpi-sub">{today ? `Hôm nay ${money(today.revenue)}` : ' '}</div></Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="surface-card"><Statistic title="Đơn hoàn thành (7 ngày)"
            value={week.orders} prefix={<ShoppingOutlined className="stat-icon stat-orange" />} />
            <div className="kpi-sub">{today ? `Hôm nay ${today.order_count} đơn · 7 ngày ${money(week.revenue)}` : ' '}</div></Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="surface-card"><Statistic title="Sản phẩm đang bán"
            value={stats.active_products} prefix={<CheckCircleOutlined className="stat-icon stat-blue" />} />
            <div className="kpi-sub">{lowCount ? `${lowCount >= 10 ? '10+' : lowCount} mẫu mã sắp hết hàng` : 'Kho ổn định'}</div></Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="surface-card"><Statistic title="Khách hàng"
            value={stats.customers} prefix={<TeamOutlined className="stat-icon stat-purple" />} />
            <div className="kpi-sub">Tài khoản đã đăng ký</div></Card>
        </Col>
      </Row>

      {todo && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {[
            { key: 'orders', to: '/orders', icon: <ShoppingOutlined />, tone: 'orange', count: todo.pendingOrders, text: 'đơn chờ xác nhận', ok: 'Không có đơn chờ xác nhận' },
            { key: 'reviews', to: '/reviews', icon: <StarOutlined />, tone: 'purple', count: todo.pendingReviews, text: 'đánh giá chờ duyệt', ok: 'Không có đánh giá chờ duyệt' },
            { key: 'stock', to: '/inventory', icon: <WarningOutlined />, tone: 'red', count: lowCount, text: 'mẫu mã sắp hết hàng', ok: 'Tồn kho ổn định' },
          ].map((t) => (
            <Col xs={24} md={8} key={t.key}>
              <Card className={`surface-card todo-card${t.count > 0 ? ' todo-on' : ''}`} hoverable onClick={() => navigate(t.to)}
                role="link" aria-label={t.count > 0 ? `${t.count} ${t.text}` : t.ok}>
                <div className="todo-body">
                  <span className={`stat-icon stat-${t.count > 0 ? t.tone : 'green'}`}>{t.icon}</span>
                  <div className="todo-text">
                    <div className="todo-count">{t.count > 0 ? (t.count >= 10 && t.key === 'stock' ? '10+' : t.count) : '0'}</div>
                    <div className="todo-label">{t.count > 0 ? t.text : t.ok}</div>
                  </div>
                  <RightOutlined className="todo-arrow" />
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={16}>
          <Card
            className="surface-card"
            title="Doanh thu theo ngày"
            extra={<Select value={days} onChange={setDays} options={[
              { value: 7, label: '7 ngày' },
              { value: 30, label: '30 ngày' },
            ]} />}
          >
            <div className="dashboard-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenue} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
                  <defs>
                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2E7D32" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#2E7D32" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#edf1ed" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={dateLabel} minTickGap={24} axisLine={false} tickLine={false} tick={{ fill: '#7a867b', fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => COMPACT_MONEY.format(value)} width={56} axisLine={false} tickLine={false} tick={{ fill: '#7a867b', fontSize: 12 }} />
                  <Tooltip
                    labelFormatter={(value) => dateLabel(value)}
                    formatter={(value, name) => [
                      name === 'revenue' ? money(value) : value,
                      name === 'revenue' ? 'Doanh thu' : 'Số đơn',
                    ]}
                  />
                  <Area type="monotone" dataKey="revenue" name="Doanh thu" stroke="#2E7D32" fill="url(#revFill)"
                    strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} isAnimationActive={!revenueLoading} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card className="surface-card" title="Đơn hàng theo trạng thái">
            {orderChart.length ? (
              <div className="dashboard-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={orderChart} dataKey="count" nameKey="status" innerRadius="55%" outerRadius="78%"
                      paddingAngle={2}>
                      {orderChart.map((entry) => (
                        <Cell key={entry.key} fill={STATUS_COLORS[entry.key] || '#9aa59b'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value, 'Số đơn']} />
                    <Legend verticalAlign="bottom" height={40} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có đơn hàng" />}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={14}>
          <Card className="surface-card" title="Đơn hàng gần đây" extra={<Link to="/orders">Xem tất cả</Link>} style={{ height: '100%' }}>
            <Table rowKey="id" size="small" pagination={false} scroll={{ x: 'max-content' }} dataSource={recent}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có đơn hàng" /> }}
              onRow={() => ({ onClick: () => navigate('/orders'), style: { cursor: 'pointer' } })}
              columns={[
                { title: 'Mã đơn', dataIndex: 'order_code', render: (c, r) => (<div><b>{c}</b><div className="cell-sub">{dateTime(r.created_at)}</div></div>) },
                { title: 'Người nhận', dataIndex: 'recipient_name' },
                { title: 'Tổng tiền', dataIndex: 'total_amount', align: 'right', render: money },
                { title: 'Trạng thái', dataIndex: 'status', render: (st) => <Tag color={orderTag(st).color} style={{ marginInlineEnd: 0 }}>{orderTag(st).text}</Tag> },
              ]} />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
      <Card className="surface-card" title="Top 5 sản phẩm bán chạy" style={{ height: '100%' }}>
        <Table rowKey="product_name" size="small" pagination={false} scroll={{ x: 'max-content' }} dataSource={stats.top_products || []}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu bán hàng" /> }}
          columns={[
            { title: 'Sản phẩm', dataIndex: 'product_name' },
            { title: 'Đã bán', dataIndex: 'total_quantity', width: 120, align: 'right', render: (quantity) => `${quantity} sp` },
          ]} />
      </Card>
        </Col>
      </Row>

      <Card className="surface-card" title="Sắp hết hàng (tồn ≤ 5)" style={{ marginTop: 16 }}>
        <Table rowKey="variant_id" size="small" pagination={false} scroll={{ x: 'max-content' }} dataSource={stats.low_stock}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có sản phẩm sắp hết hàng" /> }}
          columns={[
            { title: 'Sản phẩm', dataIndex: 'product_name' },
            { title: 'SKU', dataIndex: 'sku' },
            { title: 'Size', dataIndex: 'size_name' },
            { title: 'Màu', dataIndex: 'color_name' },
            { title: 'Tồn kho', dataIndex: 'stock_quantity',
              render: (quantity) => <Tag color={quantity === 0 ? 'red' : 'orange'}>{quantity}</Tag> },
          ]} />
      </Card>
    </>
  );
}
