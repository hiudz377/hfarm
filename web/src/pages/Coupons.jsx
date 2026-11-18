import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  App, Button, Card, DatePicker, Empty, Form, Input, InputNumber, Modal, Progress, Select, Space, Switch, Table, Tabs, Tag,
  Tooltip, Typography,
} from 'antd';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import api, { errMsg } from '../api';
import PageHeader from '../components/PageHeader.jsx';
import { money, validate } from '../utils';

const typeNames = { PERCENTAGE: 'Phần trăm', FIXED_AMOUNT: 'Số tiền cố định' };
const fmt = (d) => dayjs(d).format('DD/MM/YYYY');
// Cùng năm thì bỏ năm ở ngày bắt đầu cho gọn: 13/11 → 18/12/2026
const range = (c) => (dayjs(c.starts_at).year() === dayjs(c.ends_at).year()
  ? `${dayjs(c.starts_at).format('DD/MM')} → ${fmt(c.ends_at)}`
  : `${fmt(c.starts_at)} → ${fmt(c.ends_at)}`);

// Trạng thái thực tế của mã: tắt / chưa bắt đầu / hết hạn / hết lượt / đang chạy
function couponStatus(coupon) {
  if (!coupon.is_active) return { key: 'OFF', text: 'Đã tắt', color: 'default' };
  const now = dayjs();
  if (now.isBefore(dayjs(coupon.starts_at))) return { key: 'UPCOMING', text: 'Sắp diễn ra', color: 'blue' };
  if (now.isAfter(dayjs(coupon.ends_at))) return { key: 'EXPIRED', text: 'Hết hạn', color: 'red' };
  if (coupon.usage_limit != null && (coupon.used_count || 0) >= coupon.usage_limit) return { key: 'USED_UP', text: 'Hết lượt', color: 'orange' };
  return { key: 'RUNNING', text: 'Đang chạy', color: 'green' };
}

// "Còn 20 ngày" / "Hết hạn 3 ngày trước" / "Bắt đầu sau 2 ngày"
function validityNote(coupon) {
  const now = dayjs();
  const end = dayjs(coupon.ends_at);
  const start = dayjs(coupon.starts_at);
  if (now.isBefore(start)) return `Bắt đầu sau ${Math.max(1, Math.ceil(start.diff(now, 'day', true)))} ngày`;
  if (now.isAfter(end)) return `Hết hạn ${Math.max(1, Math.floor(now.diff(end, 'day', true)))} ngày trước`;
  const days = Math.ceil(end.diff(now, 'day', true));
  return days <= 1 ? 'Hết hạn trong hôm nay' : `Còn ${days} ngày`;
}

const TABS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'RUNNING', label: 'Đang chạy' },
  { key: 'UPCOMING', label: 'Sắp diễn ra' },
  { key: 'USED_UP', label: 'Hết lượt' },
  { key: 'EXPIRED', label: 'Hết hạn' },
  { key: 'OFF', label: 'Đã tắt' },
];

export default function Coupons() {
  const { message } = App.useApp();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('ALL');
  const [q, setQ] = useState('');
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      setCoupons((await api.get('/admin/coupons')).data);
    } catch (e) {
      message.error(`Không tải được mã giảm giá: ${errMsg(e)}`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const withStatus = useMemo(() => coupons.map((c) => ({ ...c, _status: couponStatus(c) })), [coupons]);
  const counts = useMemo(() => {
    const c = { ALL: withStatus.length };
    for (const x of withStatus) c[x._status.key] = (c[x._status.key] || 0) + 1;
    return c;
  }, [withStatus]);
  const shown = withStatus.filter((c) => (tab === 'ALL' || c._status.key === tab)
    && (!q || `${c.code} ${c.description || ''}`.toLowerCase().includes(q.toLowerCase())));

  const openModal = (record = {}) => {
    form.resetFields();
    form.setFieldsValue(record.id ? {
      ...record,
      validity: [dayjs(record.starts_at), dayjs(record.ends_at)],
    } : {
      discount_type: 'PERCENTAGE',
      min_order_amount: 0,
      per_user_limit: 1,
      is_active: true,
    });
    setEditing(record);
  };

  const save = async () => {
    const values = await validate(form);
    if (!values) return;
    const [startsAt, endsAt] = values.validity;
    const payload = {
      ...values,
      code: values.code.trim().toUpperCase(),
      starts_at: startsAt.format('YYYY-MM-DD HH:mm:ss'),
      ends_at: endsAt.format('YYYY-MM-DD HH:mm:ss'),
    };
    delete payload.validity;
    setSaving(true);
    try {
      if (editing.id) await api.put(`/admin/coupons/${editing.id}`, payload);
      else await api.post('/admin/coupons', payload);
      message.success('Đã lưu mã giảm giá');
      setEditing(null);
      load();
    } catch (e) {
      message.error(`Không lưu được mã giảm giá: ${errMsg(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (coupon, is_active) => {
    try {
      await api.put(`/admin/coupons/${coupon.id}`, { is_active });
      message.success(is_active ? `Đã bật mã ${coupon.code}` : `Đã tắt mã ${coupon.code}`);
      load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  const columns = [
    {
      title: 'Mã', dataIndex: 'code', width: 190,
      render: (code, c) => (
        <div>
          <Typography.Text strong copyable={{ tooltips: ['Sao chép mã', 'Đã sao chép'] }} className="coupon-code">{code}</Typography.Text>
          {c.description && <div className="cell-sub">{c.description}</div>}
        </div>
      ),
    },
    {
      title: 'Ưu đãi', width: 140,
      render: (_, c) => (c.discount_type === 'PERCENTAGE' ? (
        <div>
          <span className="discount-pill">-{Number(c.discount_value)}%</span>
          {c.max_discount ? <div className="cell-sub">Tối đa {money(c.max_discount)}</div> : null}
        </div>
      ) : <span className="discount-pill fixed">-{money(c.discount_value)}</span>),
    },
    {
      title: 'Điều kiện', width: 160,
      render: (_, c) => (
        <div>
          <div>{Number(c.min_order_amount) > 0 ? `Đơn từ ${money(c.min_order_amount)}` : 'Mọi đơn hàng'}</div>
          <div className="cell-sub">{c.per_user_limit ? `Tối đa ${c.per_user_limit} lần / người` : 'Không giới hạn mỗi người'}</div>
        </div>
      ),
    },
    {
      title: 'Lượt dùng', width: 140,
      render: (_, c) => {
        const used = Number(c.used_count || 0);
        if (c.usage_limit == null) return <div><b>{used}</b><div className="cell-sub">Không giới hạn</div></div>;
        const pct = Math.min(100, Math.round((used / c.usage_limit) * 100));
        return (
          <div className="coupon-usage">
            <div><b>{used}</b> / {c.usage_limit}</div>
            <Progress percent={pct} showInfo={false} size="small" strokeColor={pct >= 100 ? '#d32f2f' : pct >= 80 ? '#ed8b00' : '#2e7d32'} />
          </div>
        );
      },
    },
    {
      title: 'Hiệu lực', width: 180,
      render: (_, c) => (
        <div>
          <div>{range(c)}</div>
          <div className="cell-sub">{validityNote(c)}</div>
        </div>
      ),
    },
    {
      title: 'Trạng thái', width: 110,
      render: (_, c) => <Tag color={c._status.color} style={{ marginInlineEnd: 0 }}>{c._status.text}</Tag>,
    },
    {
      title: 'Bật / sửa', key: 'actions', width: 110, align: 'right',
      render: (_, c) => (
        <Space size={6}>
          <Switch size="small" checked={!!c.is_active} aria-label={`Bật / tắt mã ${c.code}`} onChange={(checked) => toggleActive(c, checked)} />
          <Tooltip title="Chỉnh sửa">
            <Button type="text" icon={<EditOutlined />} aria-label={`Chỉnh sửa mã ${c.code}`} onClick={() => openModal(c)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Mã giảm giá"
        description="Tạo và quản lý ưu đãi áp dụng cho đơn hàng."
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Thêm mã</Button>}
      />
      <Card className="surface-card orders-card">
        <Tabs activeKey={tab} onChange={setTab}
          items={TABS.map((t) => ({
            key: t.key,
            label: <span>{t.label}<span className="tab-count">{counts[t.key] || 0}</span></span>,
          }))} />
        <div className="filter-row">
          <Input.Search placeholder="Tìm theo mã hoặc mô tả" allowClear style={{ width: 300 }} onSearch={(v) => setQ(v.trim())} />
        </div>
        <Table
          className="data-table"
          rowKey="id"
          loading={loading}
          dataSource={shown}
          scroll={{ x: 1000 }}
          pagination={shown.length > 15 ? { pageSize: 15, showSizeChanger: false } : false}
          locale={{ emptyText: <Empty description={coupons.length ? 'Không có mã giảm giá phù hợp' : 'Chưa có mã giảm giá'} /> }}
          columns={columns}
        />
      </Card>

      <Modal
        open={!!editing}
        title={editing?.id ? 'Sửa mã giảm giá' : 'Thêm mã giảm giá'}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={saving}
        onOk={save}
        onCancel={() => setEditing(null)}
        width={680}
        destroyOnHidden
        forceRender
      >
        <Form form={form} layout="vertical">
          <div className="form-grid">
            <Form.Item name="code" label="Mã giảm giá" rules={[{ required: true, message: 'Vui lòng nhập mã' }]}>
              <Input maxLength={50} placeholder="VD: HFARM10" />
            </Form.Item>
            <Form.Item name="description" label="Mô tả">
              <Input maxLength={255} />
            </Form.Item>
          </div>
          <div className="form-grid">
            <Form.Item name="discount_type" label="Loại giảm giá" rules={[{ required: true }]}>
              <Select options={Object.entries(typeNames).map(([value, label]) => ({ value, label }))} />
            </Form.Item>
            <Form.Item name="discount_value" label="Giá trị giảm" rules={[
              { required: true, message: 'Vui lòng nhập giá trị' },
              { type: 'number', min: 0.01, message: 'Giá trị giảm phải lớn hơn 0' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (getFieldValue('discount_type') !== 'PERCENTAGE' || value == null || value <= 100) return Promise.resolve();
                  return Promise.reject(new Error('Phần trăm giảm không được vượt quá 100'));
                },
              }),
            ]}>
              <InputNumber min={0.01} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div className="form-grid">
            <Form.Item name="min_order_amount" label="Đơn hàng tối thiểu (₫)">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="max_discount" label="Giảm tối đa (₫)">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div className="form-grid">
            <Form.Item name="usage_limit" label="Giới hạn tổng lượt">
              <InputNumber min={1} precision={0} placeholder="Không giới hạn" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="per_user_limit" label="Giới hạn mỗi người">
              <InputNumber min={1} precision={0} placeholder="Không giới hạn" style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="validity" label="Thời gian hiệu lực"
            rules={[{ required: true, message: 'Vui lòng chọn thời gian hiệu lực' }]}>
            <DatePicker.RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_active" label="Kích hoạt" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
