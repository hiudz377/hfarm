import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, App, Button, Card, Collapse, Descriptions, Drawer, Dropdown, Empty, Input, Modal, Select, Space, Steps, Table,
  Tabs, Tag, Timeline, Typography,
} from 'antd';
import {
  BankOutlined, CarOutlined, CheckCircleOutlined, CheckOutlined, CloseCircleOutlined, DeleteOutlined, EllipsisOutlined,
  EyeOutlined, PrinterOutlined, ReloadOutlined, RollbackOutlined,
} from '@ant-design/icons';
import QRCode from 'qrcode';
import api, { errMsg } from '../api';
import {
  actionsOf, dangerTitle, dateTime, money, nextActionOf, NEXT_ACTIONS, ORDER_ACTIONS, ORDER_GROUPS, ORDER_STATUS,
  orderTag, PAYMENT_METHOD, PAYMENT_STATUS,
} from '../utils';
import PageHeader from '../components/PageHeader.jsx';

const ACTION_ICON = {
  confirm: <CheckOutlined />, ship: <CarOutlined />, complete: <CheckCircleOutlined />,
  cancel: <CloseCircleOutlined />, return: <RollbackOutlined />,
};

const shortDate = (d) => {
  if (!d) return '';
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(x.getDate())}/${p(x.getMonth() + 1)} ${p(x.getHours())}:${p(x.getMinutes())}`;
};

// Vị trí của đơn trên dòng tiến trình (Hủy / Hoàn trả nằm ngoài tiến trình)
const STAGE = { PENDING: 0, CONFIRMED: 1, PROCESSING: 1, SHIPPING: 2, COMPLETED: 3 };

function TabLabel({ text, count, urgent }) {
  return (
    <span>
      {text}
      <span className={`tab-count${urgent && count > 0 ? ' urgent' : ''}`}>{count > 999 ? '999+' : count}</span>
    </span>
  );
}

export default function Orders() {
  const { message, modal } = App.useApp();
  const [data, setData] = useState({ data: [], total: 0 });
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ group: 'ALL', q: '', payment: '', page: 1, limit: 20 });
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [note, setNote] = useState('');
  const [ship, setShip] = useState({ carrier: '', tracking_code: '' });
  const [pay, setPay] = useState(null); // hộp xác nhận đã nhận tiền: { code, note } | null
  const [payBusy, setPayBusy] = useState(false);
  const [evt, setEvt] = useState({ title: '', location: '' }); // ô thêm mốc hành trình
  const [evtBusy, setEvtBusy] = useState(false);
  const seq = useRef(0);

  const params = useMemo(() => {
    const group = ORDER_GROUPS.find((g) => g.key === filters.group);
    return {
      status: group ? group.statuses.join(',') : undefined,
      payment_status: filters.payment || undefined,
      q: filters.q || undefined,
      page: filters.page,
      limit: filters.limit,
    };
  }, [filters]);

  // silent = làm mới ngầm (tự động mỗi 30 giây): không hiện vòng quay, không báo lỗi
  const load = useCallback(async (silent = false) => {
    const mine = ++seq.current;
    if (!silent) setLoading(true);
    try {
      const [list, c] = await Promise.all([api.get('/admin/orders', { params }), api.get('/admin/orders/counts')]);
      if (mine !== seq.current) return; // đã có yêu cầu mới hơn (đổi tab nhanh)
      setData(list.data);
      setCounts(c.data);
    } catch (e) {
      if (!silent && mine === seq.current) message.error(errMsg(e));
    } finally {
      if (!silent && mine === seq.current) setLoading(false);
    }
  }, [params, message]);

  useEffect(() => { load(); }, [load]);

  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) loadRef.current(true); }, 30000);
    return () => clearInterval(timer);
  }, []);

  const update = (patch) => { setFilters((f) => ({ ...f, page: 1, ...patch })); setSelectedKeys([]); };
  const groupCount = (g) => (counts ? g.statuses.reduce((sum, s) => sum + (counts[s] || 0), 0) : 0);
  const totalCount = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;

  const selectedRows = data.data.filter((r) => selectedKeys.includes(r.id));

  const openDetail = async (id) => {
    try {
      setNote('');
      setShip({ carrier: '', tracking_code: '' });
      setEvt({ title: '', location: '' });
      setDetail((await api.get(`/admin/orders/${id}`)).data);
    } catch (e) { message.error(errMsg(e)); }
  };

  // Tải lại chi tiết đơn đang mở (kèm hành trình) sau khi ghi
  const reloadDetail = async () => {
    setDetail((await api.get(`/admin/orders/${detail.id}`)).data);
    await load(true);
  };

  const confirmPayment = async () => {
    setPayBusy(true);
    try {
      await api.post(`/admin/orders/${detail.id}/confirm-payment`, { transaction_code: pay.code.trim() || undefined, note: pay.note.trim() || undefined });
      message.success('Đã xác nhận nhận tiền');
      setPay(null);
      window.dispatchEvent(new Event('hfarm:orders-updated'));
      await reloadDetail();
    } catch (e) { message.error(errMsg(e)); }
    finally { setPayBusy(false); }
  };

  const addEvent = async () => {
    if (!evt.title.trim()) { message.warning('Hãy nhập nội dung hành trình'); return; }
    setEvtBusy(true);
    try {
      await api.post(`/admin/orders/${detail.id}/shipment-events`, { title: evt.title.trim(), location: evt.location.trim() || undefined });
      setEvt({ title: '', location: '' });
      await reloadDetail();
    } catch (e) { message.error(errMsg(e)); }
    finally { setEvtBusy(false); }
  };

  const removeEvent = async (eventId) => {
    try {
      await api.delete(`/admin/orders/${detail.id}/shipment-events/${eventId}`);
      await reloadDetail();
    } catch (e) { message.error(errMsg(e)); }
  };

  // Một đường duy nhất cho mọi thao tác (nút trên dòng, thanh chọn nhiều, trong ngăn chi tiết): POST /admin/orders/bulk
  const runAction = async (action, ids, extra = {}) => {
    const def = ORDER_ACTIONS[action];
    setBusy(true);
    if (ids.length === 1) setBusyId(ids[0]);
    try {
      const { data: res } = await api.post('/admin/orders/bulk', { ids, action, ...extra });
      const failed = res.results.filter((r) => !r.ok);
      if (!failed.length) {
        const tracking = res.results.length === 1 ? res.results[0].tracking_code : null;
        message.success(res.results.length === 1
          ? `${def.done}${tracking ? ` · Mã vận đơn ${tracking}` : ''}`
          : `${def.done} ${res.succeeded} đơn`);
      } else if (res.results.length === 1) {
        message.error(failed[0].error);
      } else {
        modal.warning({
          title: `${def.done} ${res.succeeded}/${res.results.length} đơn`,
          width: 560,
          content: (
            <div>
              <div style={{ marginBottom: 8 }}>{failed.length} đơn không xử lý được:</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {failed.map((f) => <li key={f.id}><b>{f.order_code || `#${f.id}`}</b>: {f.error}</li>)}
              </ul>
            </div>
          ),
        });
      }
      setSelectedKeys([]);
      window.dispatchEvent(new Event('hfarm:orders-updated'));
      await load(true);
      if (detail && ids.includes(detail.id)) setDetail((await api.get(`/admin/orders/${detail.id}`)).data);
      return res;
    } catch (e) {
      message.error(errMsg(e));
      return null;
    } finally {
      setBusy(false);
      setBusyId(null);
    }
  };

  // Hủy / hoàn trả luôn hỏi lại vì không hoàn tác được (có hoàn kho)
  const confirmDanger = (action, ids, label) => {
    const def = ORDER_ACTIONS[action];
    modal.confirm({
      title: dangerTitle(action, ids, label),
      content: 'Số lượng hàng của đơn sẽ được cộng lại vào kho. Thao tác này không hoàn tác được.',
      okText: def.label,
      cancelText: 'Không',
      okButtonProps: { danger: true },
      onOk: () => runAction(action, ids),
    });
  };

  const applyBulk = (action) => {
    const ids = selectedRows.filter((r) => ORDER_ACTIONS[action].from.includes(r.status)).map((r) => r.id);
    if (!ids.length) return;
    if (ORDER_ACTIONS[action].danger) { confirmDanger(action, ids); return; }
    if (ids.length > 1 && (action === 'ship' || action === 'complete')) {
      modal.confirm({
        title: `${ORDER_ACTIONS[action].label} ${ids.length} đơn?`,
        content: action === 'ship'
          ? 'Hệ thống tự tạo mã vận đơn cho từng đơn và dùng đơn vị vận chuyển mặc định.'
          : 'Các đơn sẽ chuyển sang Hoàn tất; đơn chưa thanh toán được ghi nhận là đã thanh toán.',
        okText: ORDER_ACTIONS[action].label,
        cancelText: 'Không',
        onOk: () => runAction(action, ids),
      });
      return;
    }
    runAction(action, ids);
  };

  const printDeliverySlip = async () => {
    // Mở cửa sổ ngay trong cú bấm (trình duyệt mới cho), tạo mã QR xong mới ghi nội dung
    const printWindow = window.open('', '_blank', 'width=800,height=700');
    if (!printWindow) {
      message.error('Trình duyệt đã chặn cửa sổ in. Hãy cho phép cửa sổ bật lên rồi thử lại.');
      return;
    }
    // QR chứa mã vận đơn: người giao/kho quét để đối chiếu nhanh (chưa có mã vận đơn thì in mã đơn)
    const qrText = detail.shipment?.tracking_code || detail.order_code;
    const qrImage = await QRCode.toDataURL(qrText, { margin: 1, width: 220, errorCorrectionLevel: 'M' }).catch(() => null);
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
    // COD: người giao thu tiền. Đã trả: không thu. Chuyển khoản chưa nhận được tiền: ghi rõ để người giao không thu nhầm.
    const isCod = detail.payment?.payment_method === 'COD';
    const dueLabel = detail.payment_status === 'PAID' ? 'Thanh toán' : isCod ? 'Thu hộ (COD)' : 'Chưa nhận chuyển khoản';
    const amountDue = detail.payment_status === 'PAID'
      ? '<strong>Đã thanh toán, không thu tiền</strong>'
      : `<strong>${escapeHtml(money(detail.total_amount))}</strong>`;
    const tracking = detail.shipment?.tracking_code
      ? `<div class="section"><strong>Mã vận đơn:</strong> ${escapeHtml(detail.shipment.tracking_code)}${detail.shipment.carrier ? ` · ${escapeHtml(detail.shipment.carrier)}` : ''}</div>`
      : '';

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
        .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .qr { text-align: center; font-size: 10px; color: #555; }
        .qr img { width: 96px; height: 96px; display: block; }
      </style></head><body>
        <div class="head">
          <div>
            <h1>Phiếu giao hàng</h1>
            <div class="muted">HFarm · Đơn ${escapeHtml(detail.order_code)}</div>
          </div>
          ${qrImage ? `<div class="qr"><img src="${qrImage}" alt="QR">${escapeHtml(qrText)}</div>` : ''}
        </div>
        ${tracking}
        <div class="section"><strong>Người nhận:</strong> ${escapeHtml(detail.recipient_name)} · ${escapeHtml(detail.recipient_phone)}<br>
        <strong>Địa chỉ:</strong> ${address}</div>
        <table><thead><tr><th>Sản phẩm</th><th>SKU</th><th class="number">SL</th><th class="number">Thành tiền</th></tr></thead>
        <tbody>${itemRows}</tbody></table>
        <div class="total">${dueLabel}: ${amountDue}</div>
        <script>window.onload = function () { window.print(); };</script>
      </body></html>`);
    printWindow.document.close();
  };

  const bulkButtons = [...NEXT_ACTIONS, 'cancel'].map((action) => ({
    action,
    count: selectedRows.filter((r) => ORDER_ACTIONS[action].from.includes(r.status)).length,
  })).filter((b) => b.count > 0);

  const columns = [
    {
      title: 'Đơn hàng', dataIndex: 'order_code', width: 190,
      render: (code, r) => (
        <div>
          <Typography.Text strong className="order-code">{code}</Typography.Text>
          <div className="cell-sub">{shortDate(r.created_at)}</div>
        </div>
      ),
    },
    {
      title: 'Người nhận', dataIndex: 'recipient_name', width: 190,
      render: (name, r) => (
        <div>
          <div>{name}</div>
          <div className="cell-sub">{r.recipient_phone}</div>
        </div>
      ),
    },
    {
      title: 'Thanh toán', dataIndex: 'total_amount', width: 190, align: 'right',
      render: (total, r) => (
        <div>
          <Typography.Text strong>{money(total)}</Typography.Text>
          <div className="cell-sub">
            {PAYMENT_METHOD[r.payment_method] || '—'} ·{' '}
            <span className={r.payment_status === 'PAID' ? 'pay-paid' : 'pay-unpaid'}>
              {r.payment_status === 'PAID' ? 'Đã thu' : PAYMENT_STATUS[r.payment_status] || r.payment_status}
            </span>
          </div>
        </div>
      ),
    },
    {
      title: 'Trạng thái', dataIndex: 'status', width: 200,
      render: (s, r) => {
        const tag = orderTag(s);
        return (
          <div>
            <Tag color={tag.color} style={{ marginInlineEnd: 0 }}>{tag.text}</Tag>
            {r.tracking_code && ['SHIPPING', 'COMPLETED'].includes(s) && (
              <div className="cell-sub tracking-line">{r.tracking_code}</div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Thao tác', key: 'actions', width: 200, align: 'right', fixed: 'right',
      render: (_, r) => {
        const next = nextActionOf(r.status);
        const more = actionsOf(r.status).filter((a) => !NEXT_ACTIONS.includes(a));
        return (
          <Space size={4} onClick={(e) => e.stopPropagation()}>
            {next ? (
              <Button type="primary" size="small" icon={ACTION_ICON[next]} loading={busyId === r.id} disabled={busy && busyId !== r.id}
                onClick={() => runAction(next, [r.id])}>
                {ORDER_ACTIONS[next].label}
              </Button>
            ) : (
              <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r.id)}>Chi tiết</Button>
            )}
            <Dropdown trigger={['click']} menu={{
              items: [
                { key: 'view', icon: <EyeOutlined />, label: 'Xem chi tiết' },
                ...more.map((a) => ({ key: a, icon: ACTION_ICON[a], label: ORDER_ACTIONS[a].label, danger: true })),
              ],
              onClick: ({ key }) => (key === 'view' ? openDetail(r.id) : confirmDanger(key, [r.id], r.order_code)),
            }}>
              <Button type="text" size="small" icon={<EllipsisOutlined />} aria-label="Thao tác khác" />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  const stage = detail ? STAGE[detail.status] : undefined;
  const detailNext = detail ? nextActionOf(detail.status) : null;
  const detailMore = detail ? actionsOf(detail.status).filter((a) => !NEXT_ACTIONS.includes(a)) : [];
  // Đơn chuyển khoản/online chưa nhận được tiền (và còn hiệu lực)
  const needPay = !!detail && detail.payment?.payment_method !== 'COD' && detail.payment_status === 'UNPAID'
    && !['CANCELLED', 'RETURNED'].includes(detail.status);

  return (
    <>
      <PageHeader title="Đơn hàng" description="Xử lý đơn theo từng nhóm. Chọn nhiều đơn để xác nhận hoặc giao hàng cùng lúc." />

      <Card className="surface-card orders-card">
        <Tabs
          activeKey={filters.group}
          onChange={(group) => update({ group })}
          items={[
            { key: 'ALL', label: <TabLabel text="Tất cả" count={totalCount} /> },
            ...ORDER_GROUPS.map((g) => ({
              key: g.key,
              label: <TabLabel text={g.label} count={groupCount(g)} urgent={g.key === 'PENDING'} />,
            })),
          ]}
        />

        <div className="filter-row">
          <Input.Search placeholder="Mã đơn, mã vận đơn, tên, SĐT" allowClear style={{ width: 300 }}
            onSearch={(q) => update({ q: q.trim() })} />
          <Select value={filters.payment} style={{ width: 190 }} onChange={(payment) => update({ payment })}
            options={[
              { value: '', label: 'Mọi thanh toán' },
              { value: 'UNPAID', label: 'Chưa thanh toán' },
              { value: 'PAID', label: 'Đã thanh toán' },
            ]} />
          <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>Làm mới</Button>
        </div>

        {selectedRows.length > 0 && (
          <div className="bulk-bar" role="region" aria-label="Thao tác nhiều đơn">
            <span className="bulk-count">Đã chọn {selectedRows.length} đơn</span>
            <Space wrap>
              {bulkButtons.map(({ action, count }) => (
                <Button key={action} type={ORDER_ACTIONS[action].danger ? 'default' : 'primary'} danger={ORDER_ACTIONS[action].danger}
                  icon={ACTION_ICON[action]} loading={busy} onClick={() => applyBulk(action)}>
                  {ORDER_ACTIONS[action].label} ({count})
                </Button>
              ))}
              {bulkButtons.length === 0 && <Typography.Text type="secondary">Các đơn đã chọn không còn thao tác nào.</Typography.Text>}
              <Button type="link" onClick={() => setSelectedKeys([])}>Bỏ chọn</Button>
            </Space>
          </div>
        )}

        <Table className="data-table" rowKey="id" loading={loading} dataSource={data.data} columns={columns}
          scroll={{ x: 980 }}
          locale={{ emptyText: <Empty description="Chưa có đơn hàng phù hợp" /> }}
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: setSelectedKeys,
            getCheckboxProps: (r) => ({ disabled: actionsOf(r.status).length === 0, 'aria-label': `Chọn đơn ${r.order_code}` }),
          }}
          onRow={(r) => ({
            onClick: (e) => {
              if (e.target.closest('.ant-checkbox-wrapper, .ant-table-selection-column, button, .ant-dropdown')) return;
              openDetail(r.id);
            },
            style: { cursor: 'pointer' },
          })}
          pagination={{
            current: filters.page, pageSize: filters.limit, total: data.total, showSizeChanger: true,
            pageSizeOptions: [20, 50, 100], showTotal: (t) => `${t} đơn`,
            onChange: (page, limit) => { setFilters((f) => ({ ...f, page: limit !== f.limit ? 1 : page, limit })); setSelectedKeys([]); },
          }} />
      </Card>

      <Drawer open={!!detail} onClose={() => setDetail(null)} width={720} destroyOnClose
        title={detail ? (
          <Space>
            <span>Đơn {detail.order_code}</span>
            <Tag color={orderTag(detail.status).color}>{orderTag(detail.status).text}</Tag>
          </Space>
        ) : ''}
        extra={detail && <Button icon={<PrinterOutlined />} onClick={printDeliverySlip}>In phiếu giao hàng</Button>}>
        {detail && (
          <>
            {stage !== undefined ? (
              <Steps size="small" current={stage} style={{ marginBottom: 20 }}
                items={[{ title: 'Chờ xác nhận' }, { title: 'Chuẩn bị hàng' }, { title: 'Đang giao' }, { title: 'Hoàn tất' }]} />
            ) : (
              <Alert type="error" showIcon style={{ marginBottom: 16 }}
                message={detail.status === 'CANCELLED' ? 'Đơn đã bị hủy' : 'Đơn đã hoàn trả'} />
            )}

            {needPay && (
              <Alert type="warning" showIcon icon={<BankOutlined />} style={{ marginBottom: 16 }}
                message="Chờ khách chuyển khoản"
                description={(
                  <>
                    Cần nhận <b>{money(detail.total_amount)}</b>, nội dung chuyển khoản <Typography.Text code copyable>{detail.order_code}</Typography.Text>.
                    {detail.payment_expires_at && detail.status === 'PENDING'
                      ? ` Quá ${dateTime(detail.payment_expires_at)} mà chưa nhận được tiền thì đơn tự hủy và hoàn kho.`
                      : ' Đơn đã xác nhận nên không tự hủy; hãy cân nhắc trước khi giao.'}
                    {' '}Khi tiền về, hệ thống tự đánh dấu nếu đã bật webhook; chưa bật thì bấm xác nhận sau khi kiểm tra sao kê.
                  </>
                )}
                action={<Button size="small" type="primary" onClick={() => setPay({ code: '', note: '' })}>Xác nhận đã nhận tiền</Button>} />
            )}

            {(detailNext || detailMore.length > 0) && (
              <div className="action-panel">
                <Input.TextArea rows={2} placeholder="Ghi chú cho lịch sử đơn (không bắt buộc)" value={note}
                  onChange={(e) => setNote(e.target.value)} />
                {detailNext === 'ship' && (
                  <Collapse ghost size="small" items={[{
                    key: 'ship',
                    label: 'Tùy chỉnh vận chuyển (không bắt buộc)',
                    children: (
                      <Space wrap>
                        <Input placeholder="Đơn vị vận chuyển (mặc định)" value={ship.carrier} style={{ width: 240 }}
                          onChange={(e) => setShip({ ...ship, carrier: e.target.value })} />
                        <Input placeholder="Mã vận đơn (để trống: tự tạo)" value={ship.tracking_code} style={{ width: 240 }}
                          onChange={(e) => setShip({ ...ship, tracking_code: e.target.value })} />
                      </Space>
                    ),
                  }]} />
                )}
                <Space wrap style={{ marginTop: 8 }}>
                  {detailNext && (
                    <Button type="primary" size="large" icon={ACTION_ICON[detailNext]} loading={busy}
                      onClick={() => runAction(detailNext, [detail.id], {
                        note: note.trim() || undefined,
                        ...(detailNext === 'ship' ? { carrier: ship.carrier.trim() || undefined, tracking_code: ship.tracking_code.trim() || undefined } : {}),
                      })}>
                      {ORDER_ACTIONS[detailNext].label}
                    </Button>
                  )}
                  {detailMore.map((a) => (
                    <Button key={a} danger icon={ACTION_ICON[a]} disabled={busy}
                      onClick={() => {
                        modal.confirm({
                          title: dangerTitle(a, [detail.id], detail.order_code),
                          content: 'Số lượng hàng của đơn sẽ được cộng lại vào kho. Thao tác này không hoàn tác được.',
                          okText: ORDER_ACTIONS[a].label, cancelText: 'Không', okButtonProps: { danger: true },
                          onOk: () => runAction(a, [detail.id], { note: note.trim() || undefined }),
                        });
                      }}>
                      {ORDER_ACTIONS[a].label}
                    </Button>
                  ))}
                </Space>
              </div>
            )}

            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Người nhận">{detail.recipient_name} - {detail.recipient_phone}</Descriptions.Item>
              <Descriptions.Item label="Địa chỉ">
                {detail.shipping_address}, {detail.ward}, {detail.district}, {detail.province}
              </Descriptions.Item>
              <Descriptions.Item label="Tài khoản">{detail.customer_name || detail.customer_email}</Descriptions.Item>
              <Descriptions.Item label="Thanh toán">
                {PAYMENT_METHOD[detail.payment?.payment_method] || detail.payment?.payment_method} - {PAYMENT_STATUS[detail.payment_status]}
                {detail.payment?.paid_at && detail.payment_status === 'PAID' && (
                  <div className="cell-sub">
                    {dateTime(detail.payment.paid_at)}
                    {detail.payment.provider === 'MANUAL' ? ' · nhân viên xác nhận' : detail.payment.provider ? ` · ${detail.payment.provider}` : ''}
                    {detail.payment.transaction_code ? ` · mã GD ${detail.payment.transaction_code}` : ''}
                  </div>
                )}
              </Descriptions.Item>
              {detail.shipment && (
                <Descriptions.Item label="Vận chuyển">
                  {detail.shipment.carrier || '—'}
                  {detail.shipment.tracking_code && (
                    <> · <Typography.Text code copyable>{detail.shipment.tracking_code}</Typography.Text></>
                  )}
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

            {detail.shipment && (
              <div style={{ marginTop: 16 }}>
                <Typography.Text strong>Hành trình giao hàng</Typography.Text>
                {detail.status === 'SHIPPING' && (
                  <Space.Compact style={{ width: '100%', marginTop: 8 }}>
                    <Input placeholder="Ví dụ: Đã đến kho phân loại Hà Nội" maxLength={200} value={evt.title}
                      onChange={(e) => setEvt({ ...evt, title: e.target.value })} onPressEnter={addEvent} />
                    <Input placeholder="Địa điểm (không bắt buộc)" maxLength={150} style={{ width: 200 }} value={evt.location}
                      onChange={(e) => setEvt({ ...evt, location: e.target.value })} onPressEnter={addEvent} />
                    <Button type="primary" loading={evtBusy} onClick={addEvent}>Thêm</Button>
                  </Space.Compact>
                )}
                {detail.shipment_events?.length ? (
                  <Timeline style={{ marginTop: 12 }} items={detail.shipment_events.map((e) => ({
                    children: (
                      <>
                        <b>{e.title}</b>{e.location ? ` · ${e.location}` : ''}
                        <div style={{ color: '#888' }}>
                          {dateTime(e.created_at)}{e.created_by_name ? ` · ${e.created_by_name}` : ''}
                          {detail.status === 'SHIPPING' && (
                            <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Xóa mốc hành trình" onClick={() => removeEvent(e.id)} />
                          )}
                        </div>
                      </>
                    ),
                  }))} />
                ) : (
                  <div className="cell-sub" style={{ marginTop: 8 }}>
                    {detail.status === 'SHIPPING' ? 'Chưa có mốc nào. Khách thấy các mốc này trong app (mục Theo dõi đơn hàng).' : 'Chưa ghi mốc nào.'}
                  </div>
                )}
              </div>
            )}

            <Typography.Text strong style={{ display: 'block', marginTop: 16 }}>Lịch sử</Typography.Text>
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

      <Modal open={!!pay} title="Xác nhận đã nhận tiền chuyển khoản" okText="Xác nhận đã nhận" cancelText="Hủy" confirmLoading={payBusy}
        onOk={confirmPayment} onCancel={() => setPay(null)} destroyOnHidden>
        {pay && detail && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert type="info" showIcon
              message={`Chỉ xác nhận sau khi đã thấy ${money(detail.total_amount)} trong sao kê, nội dung ${detail.order_code}.`} />
            <Input placeholder="Mã giao dịch ngân hàng (không bắt buộc)" maxLength={150} value={pay.code}
              onChange={(e) => setPay({ ...pay, code: e.target.value })} />
            <Input placeholder="Ghi chú (không bắt buộc)" maxLength={300} value={pay.note}
              onChange={(e) => setPay({ ...pay, note: e.target.value })} />
          </Space>
        )}
      </Modal>
    </>
  );
}
