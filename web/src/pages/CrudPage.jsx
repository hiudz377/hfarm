// Trang CRUD dùng chung (danh mục, thương hiệu): bảng + tìm kiếm + lọc trạng thái + thêm/sửa/xóa bằng modal
import { useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Empty, Form, Input, Modal, Segmented, Select, Space, Switch, Table, Tag, Tooltip } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import api, { errMsg } from '../api';
import { validate } from '../utils';
import PageHeader from '../components/PageHeader.jsx';
import ConfirmButton from '../components/ConfirmButton.jsx';

export default function CrudPage({ title, endpoint, columns, fields, deleteHint }) {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null); // null: đóng | {}: thêm mới | {id,...}: sửa
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [form] = Form.useForm();
  const lower = title.toLowerCase();

  const load = async () => {
    setLoading(true);
    try { setRows((await api.get(endpoint)).data); }
    catch (e) { message.error(errMsg(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [endpoint]);

  const shown = useMemo(() => rows.filter((r) => {
    if (status === 'ACTIVE' && !r.is_active) return false;
    if (status === 'OFF' && r.is_active) return false;
    if (!q) return true;
    return `${r.name} ${r.slug || ''} ${r.description || ''}`.toLowerCase().includes(q.toLowerCase());
  }), [rows, q, status]);

  const openModal = (record = {}) => {
    form.resetFields();
    form.setFieldsValue({ is_active: true, ...record });
    setEditing(record);
  };

  const save = async () => {
    const values = await validate(form);
    if (!values) return;
    setSaving(true);
    try {
      if (editing.id) await api.put(`${endpoint}/${editing.id}`, values);
      else await api.post(endpoint, values);
      message.success('Đã lưu');
      setEditing(null);
      load();
    } catch (e) { message.error(errMsg(e)); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    try { await api.delete(`${endpoint}/${id}`); message.success('Đã xóa'); load(); }
    catch (e) { message.error(errMsg(e)); }
  };

  const renderField = (f) => {
    const input =
      f.type === 'textarea' ? <Input.TextArea rows={3} />
      : f.type === 'select' ? <Select allowClear options={f.options} />
      : f.type === 'switch' ? <Switch />
      : <Input />;
    return (
      <Form.Item key={f.name} name={f.name} label={f.label}
        valuePropName={f.type === 'switch' ? 'checked' : 'value'}
        rules={f.required ? [{ required: true, message: 'Bắt buộc nhập' }] : []}>
        {input}
      </Form.Item>
    );
  };

  return (
    <>
      <PageHeader title={title} description={`Quản lý ${lower} của cửa hàng.`}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Thêm {lower}</Button>} />

      <Card className="surface-card">
        <div className="filter-row filter-row-top">
          <Input.Search placeholder={`Tìm ${lower}`} allowClear style={{ width: 280 }} onSearch={(v) => setQ(v.trim())} />
          <Segmented value={status} onChange={setStatus}
            options={[{ value: 'ALL', label: 'Tất cả' }, { value: 'ACTIVE', label: 'Hoạt động' }, { value: 'OFF', label: 'Ngừng' }]} />
          <span className="filter-meta">{shown.length} / {rows.length} {lower}</span>
        </div>
        <Table className="data-table" rowKey="id" loading={loading} dataSource={shown} scroll={{ x: 'max-content' }}
          pagination={shown.length > 15 ? { pageSize: 15, showSizeChanger: false } : false}
          locale={{ emptyText: <Empty description={rows.length ? `Không có ${lower} phù hợp` : `Chưa có ${lower}`} /> }}
          columns={[
            ...columns,
            { title: 'Trạng thái', dataIndex: 'is_active', width: 130,
              render: (v) => (v ? <Tag color="green" style={{ marginInlineEnd: 0 }}>Hoạt động</Tag> : <Tag style={{ marginInlineEnd: 0 }}>Ngừng</Tag>) },
            { title: 'Thao tác', key: 'actions', width: 110, align: 'right', render: (_, r) => (
              <Space className="table-actions" size={2}>
                <Tooltip title="Chỉnh sửa">
                  <Button type="text" icon={<EditOutlined />} aria-label={`Sửa ${r.name}`} onClick={() => openModal(r)} />
                </Tooltip>
                <ConfirmButton tip="Xóa" confirmTitle={`Xóa ${lower} "${r.name}"?`} description={deleteHint} okText="Xóa" okDanger onConfirm={() => remove(r.id)}
                  danger icon={<DeleteOutlined />} aria-label={`Xóa ${r.name}`} />
              </Space>
            ) },
          ]} />
      </Card>

      <Modal open={!!editing} title={editing?.id ? `Sửa ${lower}` : `Thêm ${lower}`} confirmLoading={saving}
        okText="Lưu" cancelText="Hủy" onOk={save} onCancel={() => setEditing(null)} destroyOnHidden forceRender>
        <Form form={form} layout="vertical">
          {fields(rows.filter((r) => r.id !== editing?.id)).map(renderField)}
        </Form>
      </Modal>
    </>
  );
}
