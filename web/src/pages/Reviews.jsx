import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, Card, Empty, Input, Rate, Select, Space, Table, Tabs, Tag, Typography } from 'antd';
import { CheckOutlined, EyeInvisibleOutlined, PictureOutlined, ReloadOutlined, RollbackOutlined } from '@ant-design/icons';
import api, { errMsg } from '../api';
import { REVIEW_STATUS } from '../utils';
import PageHeader from '../components/PageHeader.jsx';

const TABS = [
  { key: 'PENDING', label: 'Chờ duyệt', urgent: true },
  { key: 'APPROVED', label: 'Đã duyệt' },
  { key: 'REJECTED', label: 'Đã ẩn' },
  { key: 'ALL', label: 'Tất cả' },
];

const shortDate = (d) => {
  if (!d) return '';
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(x.getDate())}/${p(x.getMonth() + 1)}/${x.getFullYear()} ${p(x.getHours())}:${p(x.getMinutes())}`;
};

function TabLabel({ text, count, urgent }) {
  return (
    <span>
      {text}
      <span className={`tab-count${urgent && count > 0 ? ' urgent' : ''}`}>{count > 999 ? '999+' : count}</span>
    </span>
  );
}

// Duyệt đánh giá của khách: chỉ đánh giá đã duyệt mới hiện ở cửa hàng; "Ẩn" gỡ đánh giá khỏi cửa hàng nhưng vẫn giữ lại để xem
export default function Reviews() {
  const { message } = App.useApp();
  const [data, setData] = useState({ data: [], total: 0 });
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState({ tab: 'PENDING', q: '', rating: '', page: 1, limit: 20 });
  const [selectedKeys, setSelectedKeys] = useState([]);
  const seq = useRef(0);

  const params = useMemo(() => ({
    status: filters.tab === 'ALL' ? undefined : filters.tab,
    rating: filters.rating || undefined,
    q: filters.q || undefined,
    page: filters.page,
    limit: filters.limit,
  }), [filters]);

  const load = useCallback(async (silent = false) => {
    const mine = ++seq.current;
    if (!silent) setLoading(true);
    try {
      const [list, c] = await Promise.all([api.get('/admin/reviews', { params }), api.get('/admin/reviews/counts')]);
      if (mine !== seq.current) return;
      setData(list.data);
      setCounts(c.data);
    } catch (e) {
      if (!silent && mine === seq.current) message.error(errMsg(e));
    } finally {
      if (!silent && mine === seq.current) setLoading(false);
    }
  }, [params, message]);
  useEffect(() => { load(); }, [load]);

  const update = (patch) => { setFilters((f) => ({ ...f, page: 1, ...patch })); setSelectedKeys([]); };
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  const countOf = (key) => (key === 'ALL' ? total : counts?.[key] ?? 0);
  const selectedRows = data.data.filter((r) => selectedKeys.includes(r.id));

  const setStatus = async (ids, status) => {
    setBusy(true);
    try {
      const { data: res } = await api.post('/admin/reviews/bulk-status', { ids, status });
      message.success(`${status === 'APPROVED' ? 'Đã duyệt' : status === 'REJECTED' ? 'Đã ẩn' : 'Đã chuyển về chờ duyệt'} ${res.updated} đánh giá`);
      setSelectedKeys([]);
      window.dispatchEvent(new Event('hfarm:reviews-updated'));
      await load(true);
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const approvable = selectedRows.filter((r) => r.status !== 'APPROVED');
  const hideable = selectedRows.filter((r) => r.status !== 'REJECTED');

  const columns = [
    {
      title: 'Sản phẩm', dataIndex: 'product_name', width: 260,
      render: (name, r) => (
        <div className="review-product">
          {r.thumbnail
            ? <img className="review-thumb" src={r.thumbnail} alt="" />
            : <div className="review-thumb review-thumb-empty"><PictureOutlined /></div>}
          <div>
            <Typography.Text strong>{name}</Typography.Text>
            {r.order_code && <div className="cell-sub">Đơn {r.order_code}</div>}
          </div>
        </div>
      ),
    },
    {
      title: 'Đánh giá', dataIndex: 'rating',
      render: (rating, r) => (
        <div>
          <Rate disabled value={rating} className="review-stars" />
          {r.comment
            ? <Typography.Paragraph className="review-comment" ellipsis={{ rows: 3, expandable: 'collapsible', symbol: (expanded) => (expanded ? 'Thu gọn' : 'Xem thêm') }}>{r.comment}</Typography.Paragraph>
            : <div className="cell-sub">Không có nhận xét</div>}
        </div>
      ),
    },
    {
      title: 'Người đánh giá', width: 200,
      render: (_, r) => (
        <div>
          <div>{r.user_name || '—'}</div>
          <div className="cell-sub">{r.user_email}</div>
        </div>
      ),
    },
    { title: 'Ngày gửi', dataIndex: 'created_at', width: 150, render: (d) => <span className="cell-sub-inline">{shortDate(d)}</span> },
    {
      title: 'Trạng thái', dataIndex: 'status', width: 120,
      render: (s) => <Tag color={REVIEW_STATUS[s].color} style={{ marginInlineEnd: 0 }}>{REVIEW_STATUS[s].text}</Tag>,
    },
    {
      title: 'Thao tác', key: 'actions', width: 170, align: 'right', fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          {r.status !== 'APPROVED' && (
            <Button type="primary" size="small" icon={r.status === 'REJECTED' ? <RollbackOutlined /> : <CheckOutlined />}
              disabled={busy} onClick={() => setStatus([r.id], 'APPROVED')}>
              {r.status === 'REJECTED' ? 'Duyệt lại' : 'Duyệt'}
            </Button>
          )}
          {r.status !== 'REJECTED' && (
            <Button size="small" danger icon={<EyeInvisibleOutlined />} disabled={busy} onClick={() => setStatus([r.id], 'REJECTED')}>Ẩn</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Đánh giá" description="Duyệt đánh giá của khách. Chỉ đánh giá đã duyệt mới hiện ở trang sản phẩm trên ứng dụng." />
      <Card className="surface-card orders-card">
        <Tabs activeKey={filters.tab} onChange={(tab) => update({ tab })}
          items={TABS.map((t) => ({ key: t.key, label: <TabLabel text={t.label} count={countOf(t.key)} urgent={t.urgent} /> }))} />

        <div className="filter-row">
          <Input.Search placeholder="Sản phẩm, người đánh giá, nội dung" allowClear style={{ width: 300 }}
            onSearch={(q) => update({ q: q.trim() })} />
          <Select value={filters.rating} style={{ width: 160 }} onChange={(rating) => update({ rating })}
            options={[{ value: '', label: 'Mọi số sao' }, ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} sao` }))]} />
          <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>Làm mới</Button>
        </div>

        {selectedRows.length > 0 && (
          <div className="bulk-bar" role="region" aria-label="Thao tác nhiều đánh giá">
            <span className="bulk-count">Đã chọn {selectedRows.length} đánh giá</span>
            <Space wrap>
              {approvable.length > 0 && (
                <Button type="primary" icon={<CheckOutlined />} loading={busy} onClick={() => setStatus(approvable.map((r) => r.id), 'APPROVED')}>
                  Duyệt ({approvable.length})
                </Button>
              )}
              {hideable.length > 0 && (
                <Button danger icon={<EyeInvisibleOutlined />} loading={busy} onClick={() => setStatus(hideable.map((r) => r.id), 'REJECTED')}>
                  Ẩn ({hideable.length})
                </Button>
              )}
              <Button type="link" onClick={() => setSelectedKeys([])}>Bỏ chọn</Button>
            </Space>
          </div>
        )}

        <Table className="data-table" rowKey="id" loading={loading} dataSource={data.data} columns={columns} scroll={{ x: 1000 }}
          locale={{ emptyText: <Empty description={filters.tab === 'PENDING' ? 'Không có đánh giá nào đang chờ duyệt' : 'Chưa có đánh giá phù hợp'} /> }}
          rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys, getCheckboxProps: (r) => ({ 'aria-label': `Chọn đánh giá của ${r.user_name || r.user_email}` }) }}
          pagination={{
            current: filters.page, pageSize: filters.limit, total: data.total, showSizeChanger: true, pageSizeOptions: [20, 50, 100],
            showTotal: (t) => `${t} đánh giá`,
            onChange: (page, limit) => { setFilters((f) => ({ ...f, page: limit !== f.limit ? 1 : page, limit })); setSelectedKeys([]); },
          }} />
      </Card>
    </>
  );
}
