import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import {
  App, Button, Card, DatePicker, Empty, Form, Input, InputNumber, Modal, Select, Space, Switch,
  Table, Tag, Tooltip,
} from 'antd';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import api, { errMsg } from '../api';
import PageHeader from '../components/PageHeader.jsx';
import { dateTime, money } from '../utils';

const typeNames = { PERCENTAGE: 'Phần trăm', FIXED_AMOUNT: 'Số tiền cố định' };

function couponStatus(coupon) {
  if (!coupon.is_active) return { text: 'Đã tắt', color: 'default' };
  const now = dayjs();
  if (now.isBefore(dayjs(coupon.starts_at))) return { text: 'Chưa bắt đầu', color: 'blue' };
  if (now.isAfter(dayjs(coupon.ends_at))) return { text: 'Hết hạn', color: 'red' };
  return { text: 'Đang chạy', color: 'green' };
}

export default function Coupons() {
  const { message } = App.useApp();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
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
    const values = await form.validateFields();
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
      message.success(is_active ? 'Đã bật mã giảm giá' : 'Đã tắt mã giảm giá');
      load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  return (
    <>
      <PageHeader
        title="Mã giảm giá"
        description="Tạo và quản lý ưu đãi áp dụng cho đơn hàng."
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Thêm mã</Button>}
      />
      <Card className="surface-card">
        <Table
          className="data-table"
          rowKey="id"
          loading={loading}
          dataSource={coupons}
          scroll={{ x: 1050 }}
          locale={{ emptyText: <Empty description="Chưa có mã giảm giá" /> }}
          columns={[
            { title: 'Mã', dataIndex: 'code', render: (code) => <b>{code}</b> },
            { title: 'Ưu đãi', render: (_, coupon) => coupon.discount_type === 'PERCENTAGE'
              ? `${coupon.discount_value}%${coupon.max_discount ? ` (tối đa ${money(coupon.max_discount)})` : ''}`
              : money(coupon.discount_value) },
            { title: 'Đơn tối thiểu', dataIndex: 'min_order_amount', render: money },
            { title: 'Đã dùng / giới hạn', render: (_, coupon) => (
              `${coupon.used_count || 0} / ${coupon.usage_limit ?? 'Không giới hạn'}`
            ) },
            { title: 'Thời gian hiệu lực', render: (_, coupon) => (
              <span>{dateTime(coupon.starts_at)}<br />{dateTime(coupon.ends_at)}</span>
            ) },
            { title: 'Trạng thái', render: (_, coupon) => {
              const status = couponStatus(coupon);
              return <Tag color={status.color}>{status.text}</Tag>;
            } },
            { title: 'Bật', dataIndex: 'is_active', render: (active, coupon) => (
              <Switch size="small" checked={!!active} onChange={(checked) => toggleActive(coupon, checked)} />
            ) },
            { title: 'Thao tác', width: 70, fixed: 'right', render: (_, coupon) => (
              <Tooltip title="Chỉnh sửa">
                <Button type="text" icon={<EditOutlined />} aria-label="Chỉnh sửa" onClick={() => openModal(coupon)} />
              </Tooltip>
            ) },
          ]}
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
