// Trang CRUD dùng chung (danh mục, thương hiệu): bảng + thêm/sửa/xóa bằng modal
import { useEffect, useState } from 'react';
import { App, Button, Empty, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Tooltip } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import api, { errMsg } from '../api';
import PageHeader from '../components/PageHeader.jsx';

export default function CrudPage({ title, endpoint, columns, fields }) {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null); // null: đóng | {}: thêm mới | {id,...}: sửa
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try { setRows((await api.get(endpoint)).data); }
    catch (e) { message.error(errMsg(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [endpoint]);

  const openModal = (record = {}) => {
    form.resetFields();
    form.setFieldsValue({ is_active: true, ...record });
    setEditing(record);
  };

  const save = async () => {
    const values = await form.validateFields();
    try {
      if (editing.id) await api.put(`${endpoint}/${editing.id}`, values);
      else await api.post(endpoint, values);
      message.success('Đã lưu');
      setEditing(null);
      load();
    } catch (e) { message.error(errMsg(e)); }
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
      <PageHeader title={title} description={`Quản lý ${title.toLowerCase()} của cửa hàng.`}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Thêm mới</Button>} />

      <Table className="data-table" rowKey="id" loading={loading} dataSource={rows}
        locale={{ emptyText: <Empty description={`Chưa có ${title.toLowerCase()}`} /> }}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 70 },
          ...columns,
          { title: 'Trạng thái', dataIndex: 'is_active', width: 130,
            render: (v) => (v ? <Tag color="green">Hoạt động</Tag> : <Tag>Ngừng</Tag>) },
          { title: '', width: 140, render: (_, r) => (
            <Space className="table-actions">
              <Tooltip title="Chỉnh sửa">
                <Button type="text" icon={<EditOutlined />} aria-label="Chỉnh sửa" onClick={() => openModal(r)} />
              </Tooltip>
              <Popconfirm title="Xóa mục này?" okText="Xóa" cancelText="Hủy" onConfirm={() => remove(r.id)}>
                <Tooltip title="Xóa"><Button type="text" danger icon={<DeleteOutlined />} aria-label="Xóa" /></Tooltip>
              </Popconfirm>
            </Space>
          ) },
        ]} />

      <Modal open={!!editing} title={editing?.id ? `Sửa ${title.toLowerCase()}` : `Thêm ${title.toLowerCase()}`}
        okText="Lưu" cancelText="Hủy" onOk={save} onCancel={() => setEditing(null)} destroyOnHidden>
        <Form form={form} layout="vertical">
          {fields(rows.filter((r) => r.id !== editing?.id)).map(renderField)}
        </Form>
      </Modal>
    </>
  );
}
