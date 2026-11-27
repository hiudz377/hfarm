import { useEffect, useMemo, useState } from 'react';
import {
  App, Button, Card, ColorPicker, Empty, Form, Input, InputNumber, Modal, Skeleton, Tabs, Tooltip,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import api, { errMsg } from '../api';
import PageHeader from '../components/PageHeader.jsx';
import ConfirmButton from '../components/ConfirmButton.jsx';
import { SIZE_GROUPS, sizeGroup, sortSizes, validate } from '../utils';

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

  const groupedSizes = useMemo(() => {
    const sorted = sortSizes(rows.sizes);
    return SIZE_GROUPS.map((g) => ({ ...g, items: sorted.filter((s) => sizeGroup(s.name) === g.key) })).filter((g) => g.items.length);
  }, [rows.sizes]);

  const openModal = (record = {}) => {
    form.resetFields();
    form.setFieldsValue(activeTab === 'sizes'
      ? { sort_order: 0, ...record }
      : { hex_code: '#2E7D32', ...record });
    setEditing(record);
  };

  const save = async () => {
    const values = await validate(form);
    if (!values) return;
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

  const remove = async (id, name) => {
    try {
      await api.delete(`${configs[activeTab].endpoint}/${id}`);
      message.success(`Đã xóa ${configs[activeTab].title} ${name}`);
      load();
    } catch (e) {
      message.error(e.response?.status === 409
        ? `Không thể xóa ${configs[activeTab].title} "${name}" vì đang được sử dụng.`
        : errMsg(e));
    }
  };

  const actions = (record, name) => (
    <>
      <Tooltip title="Chỉnh sửa">
        <Button type="text" size="small" icon={<EditOutlined />} aria-label={`Sửa ${name}`} onClick={() => openModal(record)} />
      </Tooltip>
      <ConfirmButton tip="Xóa" confirmTitle={`Xóa ${configs[activeTab].title} "${name}"?`} okText="Xóa" okDanger onConfirm={() => remove(record.id, name)}
        size="small" danger icon={<DeleteOutlined />} aria-label={`Xóa ${name}`} />
    </>
  );

  const sizesView = loading && !rows.sizes.length ? <Skeleton active /> : !groupedSizes.length ? <Empty description="Chưa có size" /> : groupedSizes.map((g) => (
    <div className="attr-section" key={g.key}>
      <div className="attr-section-title">{g.label}<span className="attr-section-hint">{g.hint} · {g.items.length} size</span></div>
      <div className="attr-chips">
        {g.items.map((s) => (
          <span className="attr-chip" key={s.id}>
            {s.name}
            {actions(s, s.name)}
          </span>
        ))}
      </div>
    </div>
  ));

  const colorsView = loading && !rows.colors.length ? <Skeleton active /> : !rows.colors.length ? <Empty description="Chưa có màu sắc" /> : (
    <div className="color-grid">
      {rows.colors.map((c) => (
        <div className="color-card" key={c.id}>
          <span className="color-dot" style={{ backgroundColor: c.hex_code || '#ffffff' }} />
          <div className="color-text">
            <div className="color-name">{c.name}</div>
            <div className="cell-sub">{c.hex_code || 'Chưa có mã màu'}</div>
          </div>
          {actions(c, c.name)}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Size & Màu sắc"
        description="Quản lý các thuộc tính dùng để tạo mẫu mã sản phẩm. Size chữ và size số tự xếp đúng thứ tự."
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>{activeTab === 'sizes' ? 'Thêm size' : 'Thêm màu'}</Button>}
      />
      <Card className="surface-card">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'sizes', label: <span>Size<span className="tab-count">{rows.sizes.length}</span></span> },
            { key: 'colors', label: <span>Màu sắc<span className="tab-count">{rows.colors.length}</span></span> },
          ]}
        />
        {activeTab === 'sizes' ? sizesView : colorsView}
      </Card>

      <Modal
        open={!!editing}
        title={`${editing?.id ? 'Sửa' : 'Thêm'} ${configs[activeTab].title}`}
        okText="Lưu"
        cancelText="Hủy"
        onOk={save}
        onCancel={() => setEditing(null)}
        destroyOnHidden
        forceRender
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={activeTab === 'sizes' ? 'Tên size' : 'Tên màu'}
            rules={[{ required: true, message: 'Vui lòng nhập tên' }]}>
            <Input maxLength={50} placeholder={activeTab === 'sizes' ? 'VD: M, XL, 2XL, 30, 38.5' : 'VD: Xanh rêu'} />
          </Form.Item>
          {activeTab === 'sizes' ? (
            <Form.Item name="sort_order" label="Thứ tự sắp xếp" extra="Chỉ dùng cho size đặt tên đặc biệt (ví dụ Free size). Size chữ (S, M, XL...) và size số (28, 30...) tự xếp đúng thứ tự.">
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
