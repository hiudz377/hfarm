// Giao dịch tiền vào nhận qua webhook ngân hàng cần nhân viên xem: không khớp đơn, thiếu/dư tiền, đơn đã hủy, chuyển trùng.
import { useCallback, useEffect, useState } from 'react';
import { Alert, App, Button, Card, Empty, Segmented, Table, Tag, Typography } from 'antd';
import { CheckOutlined, ReloadOutlined } from '@ant-design/icons';
import api, { errMsg } from '../api';
import { dateTime, money } from '../utils';
import PageHeader from '../components/PageHeader.jsx';

const MATCH = {
  MATCHED: { text: 'Đã khớp đơn', color: 'green' },
  UNMATCHED: { text: 'Không khớp đơn nào', color: 'red' },
  AMOUNT_MISMATCH: { text: 'Chuyển thiếu', color: 'orange' },
  ORDER_CLOSED: { text: 'Đơn đã hủy', color: 'volcano' },
  ALREADY_PAID: { text: 'Chuyển trùng', color: 'gold' },
};

export default function BankTransactions() {
  const { message } = App.useApp();
  const [data, setData] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [resolved, setResolved] = useState('0');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData((await api.get('/admin/bank-transactions', { params: { resolved, page, limit: 20 } })).data);
    } catch (e) { message.error(errMsg(e)); }
    finally { setLoading(false); }
  }, [resolved, page, message]);
  useEffect(() => { load(); }, [load]);

  const markDone = async (id) => {
    try {
      await api.patch(`/admin/bank-transactions/${id}/resolve`);
      message.success('Đã đánh dấu đã xử lý');
      window.dispatchEvent(new Event('hfarm:orders-updated'));
      load();
    } catch (e) { message.error(errMsg(e)); }
  };

  const columns = [
    {
      title: 'Giao dịch', dataIndex: 'amount', width: 190,
      render: (amount, r) => (
        <div>
          <Typography.Text strong>{money(amount)}</Typography.Text>
          <div className="cell-sub">{dateTime(r.transaction_time || r.created_at)} · {r.provider} #{r.provider_tx_id}</div>
        </div>
      ),
    },
    { title: 'Nội dung chuyển khoản', dataIndex: 'content', render: (c) => c || <span className="muted-dash">—</span> },
    {
      title: 'Kết quả', dataIndex: 'match_status', width: 230,
      render: (s, r) => (
        <div>
          <Tag color={MATCH[s]?.color} style={{ marginInlineEnd: 0 }}>{MATCH[s]?.text || s}</Tag>
          {r.order_code && <div className="cell-sub">Đơn {r.order_code} · cần {money(r.order_total)}</div>}
        </div>
      ),
    },
    { title: 'Cần làm gì', dataIndex: 'note', render: (n) => n || <span className="muted-dash">—</span> },
    {
      title: '', key: 'actions', width: 140, align: 'right',
      render: (_, r) => (r.resolved
        ? <Tag style={{ marginInlineEnd: 0 }}>Đã xử lý</Tag>
        : <Button size="small" icon={<CheckOutlined />} onClick={() => markDone(r.id)}>Đã xử lý</Button>),
    },
  ];

  return (
    <>
      <PageHeader title="Giao dịch ngân hàng"
        description="Tiền vào tài khoản được ngân hàng báo về. Đơn khớp đủ tiền được đánh dấu đã thanh toán tự động; các trường hợp còn lại hiện ở đây để nhân viên xử lý."
        extra={<Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Làm mới</Button>} />

      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        message="Hoàn tiền thực hiện ngoài hệ thống"
        description="Với khoản chuyển dư, chuyển trùng hoặc tiền về sau khi đơn đã hủy: hoàn lại cho khách bằng app ngân hàng rồi bấm “Đã xử lý”. Khách chuyển thiếu rồi chuyển bù thì hệ thống tự cộng dồn; hoặc mở đơn và bấm “Xác nhận đã nhận tiền”. Nếu danh sách luôn trống, kiểm tra webhook đã bật chưa (docs/RUNBOOK.md)." />

      <Card className="surface-card">
        <div className="filter-row filter-row-top">
          <Segmented value={resolved} onChange={(v) => { setResolved(v); setPage(1); }}
            options={[{ value: '0', label: 'Cần xử lý' }, { value: '1', label: 'Đã xử lý' }]} />
          <span className="filter-meta">{data.total} giao dịch</span>
        </div>
        <Table className="data-table" rowKey="id" loading={loading} dataSource={data.data} columns={columns}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <Empty description={resolved === '0' ? 'Không có giao dịch nào cần xử lý' : 'Chưa có giao dịch đã xử lý'} /> }}
          pagination={{ current: page, pageSize: 20, total: data.total, showSizeChanger: false, onChange: setPage, hideOnSinglePage: true }} />
      </Card>
    </>
  );
}
