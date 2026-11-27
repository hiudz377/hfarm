// Mua nhóm: các nhóm khách đã tạo (admin, staff). Bật mua nhóm + chỉnh bậc giá ở ngăn sản phẩm (mục "Mua nhóm").
import { useEffect, useRef, useState } from 'react';
import { App, Card, Empty, Select, Table, Tag, Typography } from 'antd';
import { StopOutlined } from '@ant-design/icons';
import api, { errMsg } from '../api';
import { dateTime, money } from '../utils';
import PageHeader from '../components/PageHeader.jsx';
import ConfirmButton from '../components/ConfirmButton.jsx';

const STATUS = {
  OPEN: { text: 'Đang mở', color: 'processing' },
  SUCCESS: { text: 'Đã chốt', color: 'green' },
  FAILED: { text: 'Chưa đủ người', color: 'default' },
  CANCELLED: { text: 'Đã hủy', color: 'red' },
};

// 93784 giây -> "1 ngày 2 giờ"; 7500 -> "2 giờ 5 phút"
const left = (s) => {
  const m = Math.max(Math.floor(Number(s) / 60), 0);
  if (m >= 1440) return `${Math.floor(m / 1440)} ngày ${Math.floor((m % 1440) / 60)} giờ`;
  if (m >= 60) return `${Math.floor(m / 60)} giờ ${m % 60} phút`;
  return `${m} phút`;
};

export default function Groups() {
  const { message } = App.useApp();
  const [data, setData] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ status: undefined, page: 1, limit: 20 });
  const seq = useRef(0);

  const load = async () => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const res = await api.get('/admin/groups', { params: filters });
      if (mine === seq.current) setData(res.data);
    } catch (e) {
      if (mine === seq.current) message.error(errMsg(e));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  };
  useEffect(() => { load(); }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = async (g) => {
    try {
      await api.post(`/admin/groups/${g.code}/cancel`);
      message.success(`Đã hủy nhóm ${g.code}`);
      load();
    } catch (e) { message.error(errMsg(e)); }
  };

  const columns = [
    {
      title: 'Nhóm', dataIndex: 'code', width: 150,
      render: (code, g) => (
        <div>
          <Typography.Text strong style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', letterSpacing: 1 }}>{code}</Typography.Text>
          <div className="cell-sub">{dateTime(g.created_at)}</div>
        </div>
      ),
    },
    { title: 'Sản phẩm', dataIndex: 'product_name', width: 260, render: (name) => <Typography.Text strong>{name}</Typography.Text> },
    { title: 'Chủ nhóm', dataIndex: 'leader_name', width: 150, render: (n) => n || <span className="muted-dash">—</span> },
    { title: 'Người', width: 90, align: 'center', render: (_, g) => <Typography.Text strong>{g.member_count}/{g.capacity}</Typography.Text> },
    {
      title: 'Trạng thái', dataIndex: 'status', width: 190,
      render: (s, g) => (
        <div>
          <Tag color={STATUS[s].color} style={{ marginInlineEnd: 0 }}>{STATUS[s].text}</Tag>
          <div className="cell-sub">
            {s === 'OPEN' && `còn ${left(g.seconds_left)} để rủ thêm`}
            {s === 'SUCCESS' && `giảm ${g.final_percent}% · ${g.final_members} người`}
            {s === 'FAILED' && `hết hạn với ${g.member_count} người`}
          </div>
        </div>
      ),
    },
    {
      title: 'Hạn mua giá nhóm', dataIndex: 'claim_until', width: 170,
      render: (d, g) => (g.status === 'SUCCESS' ? dateTime(d) : <span className="muted-dash">—</span>),
    },
    {
      title: 'Đã mua', width: 100, align: 'center',
      render: (_, g) => (g.status === 'SUCCESS' ? `${g.bought_count}/${g.member_count}` : <span className="muted-dash">—</span>),
    },
    { title: 'Đã giảm cho khách', dataIndex: 'discount_total', width: 160, align: 'right', render: (v) => (Number(v) > 0 ? money(v) : <span className="muted-dash">—</span>) },
    {
      title: 'Thao tác', key: 'actions', width: 90, align: 'right', fixed: 'right',
      render: (_, g) => (g.status === 'OPEN' ? (
        <ConfirmButton
          tip="Hủy nhóm"
          confirmTitle="Hủy nhóm này?"
          description="Mọi thành viên sẽ không còn nhóm. Không hoàn tác được."
          okText="Hủy nhóm"
          okDanger
          danger
          onConfirm={() => cancel(g)}
          aria-label={`Hủy nhóm ${g.code}`}
          icon={<StopOutlined />}
        />
      ) : null),
    },
  ];

  return (
    <>
      <PageHeader
        title="Mua nhóm"
        description="Các nhóm khách đã tạo. Bật mua nhóm và chỉnh bậc giá ở ngăn sản phẩm. Khách chỉ trả tiền khi nhóm chốt thành công và bấm mua."
      />
      <Card className="surface-card">
        <div className="filter-row filter-row-top">
          <Select
            allowClear placeholder="Trạng thái" style={{ width: 180 }}
            value={filters.status}
            onChange={(status) => setFilters({ ...filters, status, page: 1 })}
            options={Object.entries(STATUS).map(([value, v]) => ({ value, label: v.text }))}
          />
        </div>
        <Table
          className="data-table"
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data.data}
          scroll={{ x: 1360 }}
          locale={{ emptyText: <Empty description="Chưa có nhóm nào. Bật mua nhóm ở ngăn sản phẩm để khách bắt đầu tạo nhóm." /> }}
          pagination={{
            current: filters.page, pageSize: filters.limit, total: data.total, showSizeChanger: false,
            onChange: (page) => setFilters({ ...filters, page }),
          }}
        />
      </Card>
    </>
  );
}
