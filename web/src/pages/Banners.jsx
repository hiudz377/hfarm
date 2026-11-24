// Banner trang chủ app mobile. Chỉ admin. Không có banner nào đang bật thì app hiện banner mặc định.
import { useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Card, DatePicker, Empty, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PictureOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api, { errMsg } from '../api';
import { validate } from '../utils';
import PageHeader from '../components/PageHeader.jsx';
import ConfirmButton from '../components/ConfirmButton.jsx';

const LINK_TYPES = [
  { value: 'NONE', label: 'Không liên kết' },
  { value: 'COLLECTION', label: 'Bộ sưu tập' },
  { value: 'CATEGORY', label: 'Danh mục' },
  { value: 'PRODUCT', label: 'Một sản phẩm' },
];
const COLLECTIONS = [
  { value: 'new', label: 'Hàng mới về' },
  { value: 'bestseller', label: 'Bán chạy' },
  { value: 'sale', label: 'Đang giảm giá' },
];
const FMT = 'YYYY-MM-DD HH:mm:ss';

export default function Banners() {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form] = Form.useForm();
  const linkType = Form.useWatch('link_type', form);
  const imageUrl = Form.useWatch('image_url', form);

  const load = async () => {
    setLoading(true);
    try {
      const [b, c] = await Promise.all([api.get('/admin/banners'), api.get('/admin/categories')]);
      setRows(b.data);
      setCategories(c.data);
    } catch (e) { message.error(errMsg(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openModal = (r = {}) => {
    form.resetFields();
    form.setFieldsValue({
      link_type: 'NONE', sort_order: 0, is_active: true, ...r,
      link_value: r.link_type === 'CATEGORY' ? Number(r.link_value) : r.link_value,
      starts_at: r.starts_at ? dayjs(r.starts_at) : null,
      ends_at: r.ends_at ? dayjs(r.ends_at) : null,
    });
    setEditing(r);
  };

  // Ô chọn file ẩn + nút bấm (đủ cho một ảnh duy nhất, không cần danh sách file của antd Upload)
  const fileInput = useRef(null);
  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // cho phép chọn lại đúng file đó lần sau
    if (!file) return;
    if (!/\.(jpe?g|png|webp)$/i.test(file.name) || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      message.error('Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) { message.error('Ảnh không được vượt quá 5 MB.'); return; }
    const body = new FormData();
    body.append('file', file);
    setUploading(true);
    try {
      const res = await api.post('/admin/upload', body);
      form.setFields([{ name: 'image_url', value: res.data.url, errors: [] }]); // gán ảnh và xóa lỗi "Hãy tải ảnh lên" nếu đang hiện
    } catch (err) { message.error(`Không tải được ảnh: ${errMsg(err)}`); }
    finally { setUploading(false); }
  };

  const save = async () => {
    const v = await validate(form);
    if (!v) return;
    const body = {
      ...v,
      link_value: v.link_type === 'NONE' ? null : v.link_value,
      starts_at: v.starts_at ? v.starts_at.format(FMT) : null,
      ends_at: v.ends_at ? v.ends_at.format(FMT) : null,
    };
    setSaving(true);
    try {
      if (editing.id) await api.put(`/admin/banners/${editing.id}`, body);
      else await api.post('/admin/banners', body);
      message.success('Đã lưu banner');
      setEditing(null);
      load();
    } catch (e) { message.error(errMsg(e)); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    try { await api.delete(`/admin/banners/${id}`); message.success('Đã xóa banner'); load(); }
    catch (e) { message.error(errMsg(e)); }
  };

  const linkText = (r) => {
    if (r.link_type === 'COLLECTION') return `Bộ sưu tập: ${COLLECTIONS.find((c) => c.value === r.link_value)?.label || r.link_value}`;
    if (r.link_type === 'CATEGORY') return `Danh mục: ${categories.find((c) => String(c.id) === String(r.link_value))?.name || r.link_value}`;
    if (r.link_type === 'PRODUCT') return `Sản phẩm #${r.link_value}`;
    return 'Không liên kết';
  };
  const now = dayjs();
  const state = (r) => {
    if (!r.is_active) return <Tag style={{ marginInlineEnd: 0 }}>Tắt</Tag>;
    if (r.starts_at && dayjs(r.starts_at).isAfter(now)) return <Tag color="blue" style={{ marginInlineEnd: 0 }}>Hẹn giờ</Tag>;
    if (r.ends_at && dayjs(r.ends_at).isBefore(now)) return <Tag style={{ marginInlineEnd: 0 }}>Hết hạn</Tag>;
    return <Tag color="green" style={{ marginInlineEnd: 0 }}>Đang hiển thị</Tag>;
  };

  return (
    <>
      <PageHeader title="Banner" description="Ảnh quảng cáo ở đầu trang chủ của app. Kéo ngang để xem các banner theo thứ tự."
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Thêm banner</Button>} />

      <Alert type="info" showIcon style={{ marginBottom: 16 }} message="Kích thước ảnh gợi ý"
        description="Ngang 1200 × 600 px (tỉ lệ 2:1), JPG/PNG/WebP dưới 5 MB. Chữ quan trọng nên đặt ở giữa-trái ảnh vì app có thể cắt mép." />

      <Card className="surface-card">
        <Table className="data-table" rowKey="id" loading={loading} dataSource={rows} scroll={{ x: 'max-content' }} pagination={false}
          locale={{ emptyText: <Empty description="Chưa có banner. App sẽ hiện banner mặc định." /> }}
          columns={[
            {
              title: 'Banner', dataIndex: 'title',
              render: (t, r) => (
                <div className="review-product">
                  <img className="review-thumb" style={{ width: 96, height: 48, objectFit: 'cover' }} src={r.image_url} alt="" />
                  <div>
                    <Typography.Text strong>{t}</Typography.Text>
                    {r.subtitle && <div className="cell-sub">{r.subtitle}</div>}
                  </div>
                </div>
              ),
            },
            { title: 'Liên kết', render: (_, r) => linkText(r) },
            { title: 'Thứ tự', dataIndex: 'sort_order', width: 90, align: 'center' },
            { title: 'Trạng thái', width: 140, render: (_, r) => state(r) },
            {
              title: 'Thao tác', key: 'actions', width: 110, align: 'right',
              render: (_, r) => (
                <Space className="table-actions" size={2}>
                  <Tooltip title="Chỉnh sửa"><Button type="text" icon={<EditOutlined />} aria-label={`Sửa ${r.title}`} onClick={() => openModal(r)} /></Tooltip>
                  <ConfirmButton tip="Xóa" confirmTitle={`Xóa banner "${r.title}"?`} okText="Xóa" okDanger onConfirm={() => remove(r.id)}
                    danger icon={<DeleteOutlined />} aria-label={`Xóa ${r.title}`} />
                </Space>
              ),
            },
          ]} />
      </Card>

      <Modal open={!!editing} title={editing?.id ? 'Sửa banner' : 'Thêm banner'} confirmLoading={saving} width={560}
        okText="Lưu" cancelText="Hủy" onOk={save} onCancel={() => setEditing(null)} destroyOnHidden forceRender>
        <Form form={form} layout="vertical">
          <Form.Item name="image_url" label="Ảnh banner" rules={[{ required: true, message: 'Hãy tải ảnh lên' }]}>
            <Input hidden />
          </Form.Item>
          <div style={{ marginTop: -12, marginBottom: 16 }}>
            {imageUrl ? <img src={imageUrl} alt="" style={{ width: '100%', aspectRatio: '2 / 1', objectFit: 'cover', borderRadius: 8, display: 'block', marginBottom: 8 }} /> : null}
            <input ref={fileInput} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" hidden onChange={pickImage} />
            <Button icon={<PictureOutlined />} loading={uploading} onClick={() => fileInput.current?.click()}>
              {imageUrl ? 'Đổi ảnh' : 'Tải ảnh lên'}
            </Button>
          </div>
          <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Bắt buộc nhập' }]}>
            <Input maxLength={150} placeholder="Ví dụ: Bộ sưu tập Thu Đông" />
          </Form.Item>
          <Form.Item name="subtitle" label="Mô tả ngắn"><Input maxLength={250} placeholder="Ví dụ: Giảm đến 30% toàn bộ áo khoác" /></Form.Item>
          <div className="form-grid">
            <Form.Item name="link_type" label="Bấm vào banner thì">
              <Select options={LINK_TYPES} onChange={() => form.setFieldValue('link_value', undefined)} />
            </Form.Item>
            {linkType === 'COLLECTION' && (
              <Form.Item name="link_value" label="Bộ sưu tập" rules={[{ required: true, message: 'Hãy chọn' }]}><Select options={COLLECTIONS} /></Form.Item>
            )}
            {linkType === 'CATEGORY' && (
              <Form.Item name="link_value" label="Danh mục" rules={[{ required: true, message: 'Hãy chọn' }]}>
                <Select options={categories.map((c) => ({ value: c.id, label: c.name }))} />
              </Form.Item>
            )}
            {linkType === 'PRODUCT' && (
              <Form.Item name="link_value" label="Mã sản phẩm" rules={[{ required: true, message: 'Bắt buộc nhập' }]}
                extra="Xem mã trong trang Sản phẩm.">
                <Input placeholder="Ví dụ: 12" />
              </Form.Item>
            )}
            <Form.Item name="starts_at" label="Hiển thị từ"><DatePicker showTime style={{ width: '100%' }} format="DD/MM/YYYY HH:mm" /></Form.Item>
            <Form.Item name="ends_at" label="Đến hết"><DatePicker showTime style={{ width: '100%' }} format="DD/MM/YYYY HH:mm" /></Form.Item>
            <Form.Item name="sort_order" label="Thứ tự (nhỏ hiện trước)"><InputNumber style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="is_active" label="Đang bật" valuePropName="checked"><Switch /></Form.Item>
          </div>
        </Form>
      </Modal>
    </>
  );
}
