import { useEffect, useState } from 'react';
import {
  App, Button, Card, ColorPicker, Empty, Form, Input, InputNumber, Modal, Popconfirm,
  Space, Table, Tabs, Tooltip,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import api, { errMsg } from '../api';
import PageHeader from '../components/PageHeader.jsx';

const configs = {
  sizes: { endpoint: '/admin/sizes', title: 'size' },
  colors: { endpoint: '/admin/colors', title: 'màu sắc' },
};

export default function Attributes() {
  const { message } = App.useApp();
  const [activeTab, setActiveTab] = useState('sizes');
  const [rows, setRows] = useState({ sizes: [], colors: [] });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [sizes, colors] = await Promise.all([
        api.get(configs.sizes.endpoint), api.get(configs.colors.endpoint),
      ]);
      setRows({ sizes: sizes.data, colors: colors.data });
    } catch (e) {
      message.error(`Không tải được dữ liệu thuộc tính: ${errMsg(e)}`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openModal = (record = {}) => {
    form.resetFields();
    form.setFieldsValue(activeTab === 'sizes'
      ? { sort_order: 0, ...record }
      : { hex_code: '#2E7D32', ...record });
    setEditing(record);
  };

  const save = async () => {
    const values = await form.validateFields();
    const endpoint = configs[activeTab].endpoint;
    try {
      if (editing.id) await api.put(`${endpoint}/${editing.id}`, values);
      else await api.post(endpoint, values);
      message.success(`Đã lưu ${configs[activeTab].title}`);
      setEditing(null);
      load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`${configs[activeTab].endpoint}/${id}`);
      message.success(`Đã xóa ${configs[activeTab].title}`);
      load();
    } catch (e) {
      message.error(e.response?.status === 409
        ? `Không thể xóa ${configs[activeTab].title} này vì đang được sử dụng.`
        : errMsg(e));
    }
  };

  const columns = activeTab === 'sizes'
    ? [
      { title: 'Tên size', dataIndex: 'name' },
      { title: 'Thứ tự sắp xếp', dataIndex: 'sort_order', width: 180 },
    ]
    : [
      { title: 'Tên màu', dataIndex: 'name' },
      { title: 'Mã màu', dataIndex: 'hex_code', render: (hex) => (
        <Space><span className="color-swatch" style={{ backgroundColor: hex || '#fff' }} />{hex || '—'}</Space>
      ) },
    ];

  return (
    <>
      <PageHeader
        title="Size & Màu sắc"
        description="Quản lý các thuộc tính dùng để tạo biến thể sản phẩm."
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Thêm mới</Button>}
      />
      <Card className="surface-card">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'sizes', label: 'Size' },
            { key: 'colors', label: 'Màu sắc' },
          ]}
        />
        <Table
          className="data-table"
          rowKey="id"
          loading={loading}
          dataSource={rows[activeTab]}
          pagination={false}
          locale={{ emptyText: <Empty description={`Chưa có ${configs[activeTab].title}`} /> }}
          columns={[
            ...columns,
            { title: 'Thao tác', width: 110, render: (_, record) => (
              <Space className="table-actions" size={4}>
                <Tooltip title="Chỉnh sửa">
                  <Button type="text" icon={<EditOutlined />} aria-label="Chỉnh sửa" onClick={() => openModal(record)} />
                </Tooltip>
                <Popconfirm title="Xóa mục này?" okText="Xóa" cancelText="Hủy" onConfirm={() => remove(record.id)}>
                  <Tooltip title="Xóa">
                    <Button type="text" danger icon={<DeleteOutlined />} aria-label="Xóa" />
                  </Tooltip>
                </Popconfirm>
              </Space>
            ) },
          ]}
        />
      </Card>

      <Modal
        open={!!editing}
        title={`${editing?.id ? 'Sửa' : 'Thêm'} ${configs[activeTab].title}`}
        okText="Lưu"
        cancelText="Hủy"
        onOk={save}
        onCancel={() => setEditing(null)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={activeTab === 'sizes' ? 'Tên size' : 'Tên màu'}
            rules={[{ required: true, message: 'Vui lòng nhập tên' }]}>
            <Input maxLength={50} />
          </Form.Item>
          {activeTab === 'sizes' ? (
            <Form.Item name="sort_order" label="Thứ tự sắp xếp">
              <InputNumber precision={0} style={{ width: '100%' }} />
            </Form.Item>
          ) : (
            <Form.Item
              name="hex_code"
              label="Mã màu"
              getValueFromEvent={(color) => color.toHexString()}
              getValueProps={(value) => ({ value: value || '#2E7D32' })}
              rules={[{ pattern: /^#[0-9A-Fa-f]{6}$/, message: 'Mã màu phải có dạng #RRGGBB' }]}
            >
              <ColorPicker showText />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}
