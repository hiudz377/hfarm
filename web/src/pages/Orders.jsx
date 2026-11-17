import { useEffect, useState } from 'react';
import {
  App, Button, Card, Descriptions, Drawer, Empty, Input, Segmented, Space, Table, Tag, Timeline,
  Tooltip, Typography,
} from 'antd';
import { EyeOutlined, PrinterOutlined } from '@ant-design/icons';
import api, { errMsg } from '../api';
import { dateTime, money, NEXT_STATUS, ORDER_STATUS, PAYMENT_STATUS } from '../utils';
import PageHeader from '../components/PageHeader.jsx';

export default function Orders() {
  const { message } = App.useApp();
  const [data, setData] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ status: '', q: '', page: 1, limit: 10 });
  const [detail, setDetail] = useState(null);
  const [note, setNote] = useState('');
  const [ship, setShip] = useState({ carrier: '', tracking_code: '' });

  const load = async () => {
    setLoading(true);
    try { setData((await api.get('/admin/orders', { params: filters })).data); }
    catch (e) { message.error(errMsg(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [filters]);

  const openDetail = async (id) => {
    try {
      setNote('');
      setShip({ carrier: '', tracking_code: '' });
      setDetail((await api.get(`/admin/orders/${id}`)).data);
    } catch (e) { message.error(errMsg(e)); }
  };

  const changeStatus = async (status) => {
    try {
      const res = await api.patch(`/admin/orders/${detail.id}/status`, { status, note, ...ship });
      setDetail(res.data);
      setNote('');
      message.success('Đã cập nhật trạng thái');
      window.dispatchEvent(new Event('hfarm:orders-updated'));
      load();
    } catch (e) { message.error(errMsg(e)); }
  };

  const printDeliverySlip = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=700');
    if (!printWindow) {
      message.error('Trình duyệt đã chặn cửa sổ in. Hãy cho phép cửa sổ bật lên rồi thử lại.');
      return;
    }
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
    const itemRows = detail.items.map((item) => `
      <tr>
        <td>${escapeHtml(item.product_name)} (${escapeHtml(item.size_name)} / ${escapeHtml(item.color_name)})</td>
        <td>${escapeHtml(item.sku)}</td>
        <td class="number">${escapeHtml(item.quantity)}</td>
        <td class="number">${escapeHtml(money(item.line_total))}</td>
      </tr>`).join('');
    const address = [detail.shipping_address, detail.ward, detail.district, detail.province]
      .filter(Boolean).map(escapeHtml).join(', ');
    const amountDue = detail.payment_status === 'PAID'
      ? '<strong>Đã thanh toán</strong>'
      : `<strong>${escapeHtml(money(detail.total_amount))}</strong>`;

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html lang="vi"><head><meta charset="utf-8"><title>Phiếu giao hàng ${escapeHtml(detail.order_code)}</title>
      <style>
        @page { size: A5 portrait; margin: 10mm; }
        body { font: 12px Arial, sans-serif; color: #222; }
        h1 { margin: 0 0 4px; font-size: 19px; }
        .muted { color: #555; margin-bottom: 14px; }
        .section { margin: 12px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 6px 4px; border-bottom: 1px solid #ddd; text-align: left; }
        th { background: #f3f5f3; }
        .number { text-align: right; white-space: nowrap; }
        .total { margin-top: 14px; text-align: right; font-size: 16px; }
      </style></head><body>
        <h1>Phiếu giao hàng</h1>
        <div class="muted">HFarm · Đơn ${escapeHtml(detail.order_code)}</div>
        <div class="section"><strong>Người nhận:</strong> ${escapeHtml(detail.recipient_name)} · ${escapeHtml(detail.recipient_phone)}<br>
        <strong>Địa chỉ:</strong> ${address}</div>
        <table><thead><tr><th>Sản phẩm</th><th>SKU</th><th class="number">SL</th><th class="number">Thành tiền</th></tr></thead>
        <tbody>${itemRows}</tbody></table>
        <div class="total">Cần thu: ${amountDue}</div>
        <script>window.onload = function () { window.print(); };</script>
      </body></html>`);
    printWindow.document.close();
  };

  const next = detail ? NEXT_STATUS[detail.status] : [];

  return (
    <>
      <PageHeader title="Đơn hàng" description="Theo dõi, xử lý và cập nhật trạng thái đơn hàng."
        extra={<Space wrap>
        <Segmented value={filters.status}
          options={[{ value: '', label: 'Tất cả' },
            ...Object.entries(ORDER_STATUS).map(([value, v]) => ({ value, label: v.text }))]}
          onChange={(status) => setFilters({ ...filters, status, page: 1 })} />
        <Input.Search placeholder="Mã đơn, tên, SĐT" allowClear style={{ width: 240 }}
          onSearch={(q) => setFilters({ ...filters, q, page: 1 })} />
      </Space>} />

      <Card className="surface-card">
      <Table className="data-table" rowKey="id" loading={loading} dataSource={data.data}
        locale={{ emptyText: <Empty description="Chưa có đơn hàng phù hợp" /> }}
        pagination={{ current: filters.page, pageSize: filters.limit, total: data.total, showSizeChanger: false,
          onChange: (page) => setFilters({ ...filters, page }) }}
        columns={[
          { title: 'Mã đơn', dataIndex: 'order_code' },
          { title: 'Người nhận', dataIndex: 'recipient_name' },
          { title: 'SĐT', dataIndex: 'recipient_phone' },
          { title: 'Tổng tiền', dataIndex: 'total_amount', render: money },
          { title: 'Thanh toán', dataIndex: 'payment_status', render: (s) => PAYMENT_STATUS[s] },
          { title: 'Trạng thái', dataIndex: 'status',
            render: (s) => <Tag color={ORDER_STATUS[s].color}>{ORDER_STATUS[s].text}</Tag> },
          { title: 'Ngày đặt', dataIndex: 'created_at', render: dateTime },
          { title: '', width: 70, render: (_, r) => (
            <Tooltip title="Xem chi tiết">
              <Button type="text" icon={<EyeOutlined />} aria-label="Xem chi tiết" onClick={() => openDetail(r.id)} />
            </Tooltip>
          ) },
        ]} />
      </Card>

      <Drawer open={!!detail} onClose={() => setDetail(null)} width={720} destroyOnClose
        title={detail ? `Đơn ${detail.order_code}` : ''}>
        {detail && (
          <>
            <Button icon={<PrinterOutlined />} onClick={printDeliverySlip} style={{ marginBottom: 16 }}>
              In phiếu giao hàng (A5)
            </Button>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Trạng thái">
                <Tag color={ORDER_STATUS[detail.status].color}>{ORDER_STATUS[detail.status].text}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Người nhận">{detail.recipient_name} - {detail.recipient_phone}</Descriptions.Item>
              <Descriptions.Item label="Địa chỉ">
                {detail.shipping_address}, {detail.ward}, {detail.district}, {detail.province}
              </Descriptions.Item>
              <Descriptions.Item label="Tài khoản">{detail.customer_name || detail.customer_email}</Descriptions.Item>
              <Descriptions.Item label="Thanh toán">
                {detail.payment?.payment_method} - {PAYMENT_STATUS[detail.payment_status]}
              </Descriptions.Item>
              {detail.shipment && (
                <Descriptions.Item label="Vận chuyển">
                  {detail.shipment.carrier || '—'} {detail.shipment.tracking_code ? `(${detail.shipment.tracking_code})` : ''}
                </Descriptions.Item>
              )}
              {detail.customer_note && <Descriptions.Item label="Ghi chú khách">{detail.customer_note}</Descriptions.Item>}
            </Descriptions>

            <Table rowKey="id" size="small" pagination={false} style={{ marginTop: 16 }} dataSource={detail.items}
              columns={[
                { title: 'Sản phẩm', render: (_, i) => `${i.product_name} (${i.size_name}/${i.color_name})` },
                { title: 'SKU', dataIndex: 'sku' },
                { title: 'Đơn giá', dataIndex: 'unit_price', render: money },
                { title: 'SL', dataIndex: 'quantity' },
                { title: 'Thành tiền', dataIndex: 'line_total', render: money },
              ]} />
            <Descriptions size="small" column={1} style={{ marginTop: 12 }}>
              <Descriptions.Item label="Tạm tính">{money(detail.subtotal)}</Descriptions.Item>
              <Descriptions.Item label="Giảm giá">- {money(detail.discount_amount)}</Descriptions.Item>
              <Descriptions.Item label="Phí vận chuyển">{money(detail.shipping_fee)}</Descriptions.Item>
              <Descriptions.Item label="Tổng cộng"><b>{money(detail.total_amount)}</b></Descriptions.Item>
            </Descriptions>

            {next.length > 0 && (
              <div style={{ margin: '16px 0', padding: 12, background: '#fafafa', borderRadius: 8 }}>
                <Typography.Text strong>Cập nhật trạng thái</Typography.Text>
                <Input.TextArea rows={2} placeholder="Ghi chú (không bắt buộc)" value={note}
                  onChange={(e) => setNote(e.target.value)} style={{ margin: '8px 0' }} />
                {next.includes('SHIPPING') && (
                  <Space style={{ marginBottom: 8 }}>
                    <Input placeholder="Đơn vị vận chuyển" value={ship.carrier}
                      onChange={(e) => setShip({ ...ship, carrier: e.target.value })} />
                    <Input placeholder="Mã vận đơn" value={ship.tracking_code}
                      onChange={(e) => setShip({ ...ship, tracking_code: e.target.value })} />
                  </Space>
                )}
                <div>
                  <Space wrap>
                    {next.map((s) => (
                      <Button key={s} type={s === 'CANCELLED' || s === 'RETURNED' ? 'default' : 'primary'}
                        danger={s === 'CANCELLED' || s === 'RETURNED'} onClick={() => changeStatus(s)}>
                        {ORDER_STATUS[s].text}
                      </Button>
                    ))}
                  </Space>
                </div>
              </div>
            )}

            <Typography.Text strong>Lịch sử</Typography.Text>
            <Timeline style={{ marginTop: 12 }} items={detail.history.map((h) => ({
              children: (
                <>
                  <b>{ORDER_STATUS[h.new_status]?.text || h.new_status}</b> · {dateTime(h.created_at)}
                  {h.changed_by_name ? ` · ${h.changed_by_name}` : ''}
                  {h.note ? <div style={{ color: '#888' }}>{h.note}</div> : null}
                </>
              ),
            }))} />
          </>
        )}
      </Drawer>
    </>
  );
}
