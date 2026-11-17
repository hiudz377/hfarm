import { useEffect, useState } from 'react';
import {
  App, Button, Card, Col, Empty, Row, Select, Statistic, Table, Tag,
} from 'antd';
import {
  CheckCircleOutlined, DollarCircleOutlined, ShoppingOutlined, TeamOutlined,
} from '@ant-design/icons';
import {
  Cell, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import api, { errMsg } from '../api';
import { money, ORDER_STATUS } from '../utils';
import PageHeader from '../components/PageHeader.jsx';

const CHART_COLORS = ['#2E7D32', '#1976D2', '#00ACC1', '#8E24AA', '#F9A825', '#E53935', '#6D4C41'];
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

  const countOf = (status) => Number(stats.orders_by_status.find((row) => row.status === status)?.count || 0);
  const orderChart = stats.orders_by_status
    .filter((row) => Number(row.count) > 0)
    .map((row) => ({ status: ORDER_STATUS[row.status]?.text || row.status, count: Number(row.count) }));

  return (
    <>
      <PageHeader title="Tổng quan" description="Tình hình hoạt động cửa hàng." />
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card className="surface-card"><Statistic title="Doanh thu (đơn hoàn thành)"
            value={money(stats.revenue)} prefix={<DollarCircleOutlined className="stat-icon stat-green" />} /></Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="surface-card"><Statistic title="Đơn chờ xác nhận"
            value={countOf('PENDING')} prefix={<ShoppingOutlined className="stat-icon stat-orange" />} /></Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="surface-card"><Statistic title="Sản phẩm đang bán"
            value={stats.active_products} prefix={<CheckCircleOutlined className="stat-icon stat-blue" />} /></Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="surface-card"><Statistic title="Khách hàng"
            value={stats.customers} prefix={<TeamOutlined className="stat-icon stat-purple" />} /></Card>
        </Col>
      </Row>

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
                <LineChart data={revenue} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid stroke="#edf1ed" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={dateLabel} minTickGap={24} />
                  <YAxis tickFormatter={(value) => COMPACT_MONEY.format(value)} width={56} />
                  <Tooltip
                    labelFormatter={(value) => dateLabel(value)}
                    formatter={(value, name) => [
                      name === 'revenue' ? money(value) : value,
                      name === 'revenue' ? 'Doanh thu' : 'Số đơn',
                    ]}
                  />
                  <Line type="monotone" dataKey="revenue" name="Doanh thu" stroke="#2E7D32"
                    strokeWidth={3} dot={false} activeDot={{ r: 5 }} isAnimationActive={!revenueLoading} />
                </LineChart>
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
                      {orderChart.map((entry, index) => (
                        <Cell key={entry.status} fill={CHART_COLORS[index % CHART_COLORS.length]} />
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

      <Card className="surface-card" title="Top 5 sản phẩm bán chạy" style={{ marginTop: 16 }}>
        <Table rowKey="product_name" size="small" pagination={false} dataSource={stats.top_products || []}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu bán hàng" /> }}
          columns={[
            { title: 'Sản phẩm', dataIndex: 'product_name' },
            { title: 'Đã bán', dataIndex: 'total_quantity', width: 140, render: (quantity) => `${quantity} sản phẩm` },
          ]} />
      </Card>

      <Card className="surface-card" title="Sắp hết hàng (tồn ≤ 5)" style={{ marginTop: 16 }}>
        <Table rowKey="variant_id" size="small" pagination={false} dataSource={stats.low_stock}
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
