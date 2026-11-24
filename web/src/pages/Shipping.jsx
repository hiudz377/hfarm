// Phí vận chuyển theo vùng. Staff xem được; chỉ admin thêm/sửa/xóa (backend chặn bằng requireRole).
import { useEffect, useState } from 'react';
import { Alert, App, Button, Card, Empty, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import api, { errMsg } from '../api';
import { money, validate } from '../utils';
import { useAuth } from '../auth/AuthProvider.jsx';
import PageHeader from '../components/PageHeader.jsx';
import ConfirmButton from '../components/ConfirmButton.jsx';

const eta = (z) => (z.eta_min_days === z.eta_max_days ? `${z.eta_min_days} ngày` : `${z.eta_min_days} - ${z.eta_max_days} ngày`);

export default function Shipping() {
  const { message } = App.useApp();
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null); // null: đóng | {}: thêm | {id,...}: sửa
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try { setRows((await api.get('/admin/shipping-zones')).data); }
    catch (e) { message.error(errMsg(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openModal = (record = {}) => {
    form.resetFields();
    form.setFieldsValue({ fee: 30000, free_over: null, eta_min_days: 2, eta_max_days: 5, is_active: true, provinces: [], ...record });
    setEditing(record);
  };

  const save = async () => {
    const values = await validate(form);
    if (!values) return;
    setSaving(true);
    try {
      if (editing.id) await api.put(`/admin/shipping-zones/${editing.id}`, values);
      else await api.post('/admin/shipping-zones', values);
      message.success('Đã lưu vùng vận chuyển');
      setEditing(null);
      load();
    } catch (e) { message.error(errMsg(e)); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    try { await api.delete(`/admin/shipping-zones/${id}`); message.success('Đã xóa'); load(); }
    catch (e) { message.error(errMsg(e)); }
  };

  const columns = [
    {
      title: 'Vùng', dataIndex: 'name',
      render: (name, r) => (
        <div>
          <Typography.Text strong>{name}</Typography.Text>
          {r.is_default && <Tag color="green" style={{ marginInlineStart: 8 }}>Mặc định</Tag>}
          <div className="cell-sub">
            {r.is_default ? 'Mọi nơi không thuộc vùng nào khác' : (r.provinces || []).join(', ')}
          </div>
        </div>
      ),
    },
    { title: 'Phí ship', dataIndex: 'fee', width: 130, align: 'right', render: money },
    {
      title: 'Miễn phí từ', dataIndex: 'free_over', width: 150, align: 'right',
      render: (v) => (v === null ? <span className="muted-dash">Không miễn phí</span> : money(v)),
    },
    { title: 'Thời gian giao', width: 130, render: (_, r) => eta(r) },
    {
      title: 'Trạng thái', dataIndex: 'is_active', width: 120,
      render: (v) => (v ? <Tag color="green" style={{ marginInlineEnd: 0 }}>Đang áp dụng</Tag> : <Tag style={{ marginInlineEnd: 0 }}>Tắt</Tag>),
    },
    ...(isAdmin ? [{
      title: 'Thao tác', key: 'actions', width: 110, align: 'right',
      render: (_, r) => (
        <Space className="table-actions" size={2}>
          <Tooltip title="Chỉnh sửa">
            <Button type="text" icon={<EditOutlined />} aria-label={`Sửa vùng ${r.name}`} onClick={() => openModal(r)} />
          </Tooltip>
          {!r.is_default && (
            <ConfirmButton tip="Xóa" confirmTitle={`Xóa vùng "${r.name}"?`}
              description="Tỉnh/thành của vùng này sẽ tính phí theo vùng mặc định. Đơn đã đặt không bị ảnh hưởng."
              okText="Xóa" okDanger onConfirm={() => remove(r.id)} danger icon={<DeleteOutlined />} aria-label={`Xóa vùng ${r.name}`} />
          )}
        </Space>
      ),
    }] : []),
  ];

  return (
    <>
      <PageHeader title="Vận chuyển" description="Phí ship và thời gian giao dự kiến theo tỉnh/thành nhận hàng."
        extra={isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Thêm vùng</Button>} />

      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        message="Cách tính phí"
        description="Tỉnh/thành của địa chỉ nhận hàng được so với danh sách của từng vùng (không phân biệt hoa thường, dấu, chữ “Tỉnh”/“TP.”). Không thuộc vùng nào thì dùng vùng Mặc định. Phí về 0 khi tạm tính của đơn đạt mức “Miễn phí từ” của vùng." />

      <Card className="surface-card">
        <Table className="data-table" rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={false}
          scroll={{ x: 'max-content' }} locale={{ emptyText: <Empty description="Chưa có vùng vận chuyển" /> }} />
      </Card>

      <Modal open={!!editing} title={editing?.id ? 'Sửa vùng vận chuyển' : 'Thêm vùng vận chuyển'} confirmLoading={saving}
        okText="Lưu" cancelText="Hủy" onOk={save} onCancel={() => setEditing(null)} destroyOnHidden forceRender>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Tên vùng" rules={[{ required: true, message: 'Bắt buộc nhập' }]}>
            <Input maxLength={120} placeholder="Ví dụ: Nội thành Hà Nội" />
          </Form.Item>
          {!editing?.is_default && (
            <Form.Item name="provinces" label="Tỉnh / thành thuộc vùng"
              rules={[{ required: true, type: 'array', min: 1, message: 'Nhập ít nhất một tỉnh/thành' }]}
              extra="Gõ tên rồi nhấn Enter để thêm. Một tỉnh chỉ thuộc một vùng.">
              <Select mode="tags" open={false} tokenSeparators={[',']} placeholder="Hà Nội, Hồ Chí Minh..." />
            </Form.Item>
          )}
          <div className="form-grid">
            <Form.Item name="fee" label="Phí ship (₫)" rules={[{ required: true, message: 'Bắt buộc nhập' }]}>
              <InputNumber min={0} step={1000} style={{ width: '100%' }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(v) => v.replace(/\./g, '')} />
            </Form.Item>
            <Form.Item name="free_over" label="Miễn phí từ (₫)" extra="Để trống: không bao giờ miễn phí.">
              <InputNumber min={0} step={10000} style={{ width: '100%' }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(v) => v.replace(/\./g, '')} />
            </Form.Item>
            <Form.Item name="eta_min_days" label="Giao nhanh nhất (ngày)" rules={[{ required: true, message: 'Bắt buộc nhập' }]}>
              <InputNumber min={0} max={60} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="eta_max_days" label="Giao chậm nhất (ngày)" rules={[{ required: true, message: 'Bắt buộc nhập' }]}>
              <InputNumber min={0} max={60} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          {!editing?.is_default && (
            <Form.Item name="is_active" label="Đang áp dụng" valuePropName="checked"><Switch /></Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}
