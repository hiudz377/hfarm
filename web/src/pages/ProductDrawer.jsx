// Thêm/sửa sản phẩm. Tab 1: thông tin chung. Tab 2: biến thể (size/màu/SKU/giá) và tồn kho.
import { useEffect, useState } from 'react';
import {
  App, Button, Drawer, Form, Image, Input, InputNumber, Modal, Radio, Select, Space, Switch, Table,
  Tabs, Tag, Upload,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import api, { errMsg } from '../api';
import { money, PRODUCT_STATUS } from '../utils';

const normalizeSkuPart = (value) => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/gi, 'd')
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

const productAbbreviation = (name) => String(name || '').trim().split(/\s+/)
  .filter(Boolean)
  .map((word) => normalizeSkuPart(word)[0] || '')
  .join('') || 'SP';

export default function ProductDrawer({ open, productId, onClose, onChanged }) {
  const { message } = App.useApp();
  const [id, setId] = useState(null);
  const [product, setProduct] = useState(null);
  const [meta, setMeta] = useState({ categories: [], brands: [], sizes: [], colors: [] });
  const [tab, setTab] = useState('info');
  const [imageList, setImageList] = useState([]);
  const [externalImage, setExternalImage] = useState('');
  const [previewImage, setPreviewImage] = useState('');
  const [infoForm] = Form.useForm();
  const [variantForm] = Form.useForm();
  const [stockForm] = Form.useForm();
  const [variantModal, setVariantModal] = useState(null); // null | {} (thêm) | variant (sửa)
  const [stockModal, setStockModal] = useState(null); // null | variant
  const [quickForm] = Form.useForm();
  const [quickModal, setQuickModal] = useState(false);
  const [quickVariants, setQuickVariants] = useState([]);

  const loadProduct = async (pid) => {
    const p = (await api.get(`/admin/products/${pid}`)).data;
    setProduct(p);
    infoForm.setFieldsValue(p);
    setImageList(p.images.map((image) => ({
      uid: String(image.id),
      name: image.image_url.split('/').pop() || 'Ảnh sản phẩm',
      status: 'done',
      url: image.image_url,
      response: { url: image.image_url },
    })));
  };

  useEffect(() => {
    if (!open) return;
    setTab('info');
    setId(productId);
    setProduct(null);
    setImageList([]);
    setExternalImage('');
    infoForm.resetFields();
    infoForm.setFieldsValue({ status: 'DRAFT', base_price: 0 });
    (async () => {
      try {
        const [categories, brands, sizes, colors] = await Promise.all(
          ['categories', 'brands', 'sizes', 'colors'].map((k) => api.get(`/admin/${k}`).then((r) => r.data)));
        setMeta({ categories, brands, sizes, colors });
        if (productId) await loadProduct(productId);
      } catch (e) { message.error(errMsg(e)); }
    })();
  }, [open, productId]);

  useEffect(() => {
    if (quickModal) {
      quickForm.setFieldsValue({
        price: product?.base_price ?? 0,
        quantity: 0,
        size_ids: [],
        color_ids: [],
      });
    }
  }, [quickModal, product?.base_price]);

  const saveInfo = async () => {
    const values = await infoForm.validateFields();
    if (imageList.some((image) => image.status === 'uploading')) {
      message.warning('Vui lòng đợi tải ảnh hoàn tất trước khi lưu.');
      return;
    }
    values.images = imageList
      .filter((image) => image.status === 'done')
      .map((image) => image.response?.url || image.url)
      .filter(Boolean);
    try {
      if (id) {
        await api.put(`/admin/products/${id}`, values);
        message.success('Đã lưu');
        await loadProduct(id);
      } else {
        const res = await api.post('/admin/products', values);
        setId(res.data.id);
        await loadProduct(res.data.id);
        setTab('variants');
        message.success('Đã tạo sản phẩm. Hãy thêm các biến thể (size/màu) ở tab này');
      }
      onChanged();
    } catch (e) { message.error(errMsg(e)); }
  };

  const saveVariant = async () => {
    const values = await variantForm.validateFields();
    try {
      if (variantModal.id) await api.put(`/admin/products/variants/${variantModal.id}`, values);
      else await api.post(`/admin/products/${id}/variants`, values);
      message.success('Đã lưu biến thể');
      setVariantModal(null);
      await loadProduct(id);
      onChanged();
    } catch (e) { message.error(errMsg(e)); }
  };

  const toggleActive = async (v, checked) => {
    try { await api.put(`/admin/products/variants/${v.id}`, { is_active: checked }); await loadProduct(id); }
    catch (e) { message.error(errMsg(e)); }
  };

  const saveStock = async () => {
    const values = await stockForm.validateFields();
    try {
      await api.post(`/admin/products/variants/${stockModal.id}/stock`, values);
      message.success('Đã cập nhật kho');
      setStockModal(null);
      await loadProduct(id);
      onChanged();
    } catch (e) { message.error(errMsg(e)); }
  };

  const openVariant = (v = {}) => {
    variantForm.resetFields();
    variantForm.setFieldsValue({ price: product?.base_price, quantity: 0, ...v });
    setVariantModal(v);
  };

  const openQuickCreate = () => {
    setQuickVariants([]);
    setQuickModal(true);
  };

  const generateQuickVariants = async () => {
    const values = await quickForm.validateFields();
    const count = values.size_ids.length * values.color_ids.length;
    if (count > 100) {
      message.error('Mỗi lần chỉ có thể tạo tối đa 100 biến thể.');
      return;
    }
    const sizes = new Map(meta.sizes.map((size) => [size.id, size]));
    const colors = new Map(meta.colors.map((color) => [color.id, color]));
    const prefix = productAbbreviation(product?.name);
    setQuickVariants(values.size_ids.flatMap((sizeId) => values.color_ids.map((colorId) => ({
      size_id: sizeId,
      color_id: colorId,
      size_name: sizes.get(sizeId)?.name,
      color_name: colors.get(colorId)?.name,
      sku: `${prefix}-${normalizeSkuPart(colors.get(colorId)?.name)}-${normalizeSkuPart(sizes.get(sizeId)?.name)}`,
      price: values.price,
      quantity: values.quantity,
    }))));
  };

  const saveQuickVariants = async () => {
    const skus = quickVariants.map((variant) => variant.sku.trim());
    if (!skus.length || skus.some((sku) => !sku)) {
      message.error('Vui lòng tạo biến thể và nhập đầy đủ SKU.');
      return;
    }
    if (new Set(skus.map((sku) => sku.toUpperCase())).size !== skus.length) {
      message.error('SKU trong danh sách không được trùng nhau.');
      return;
    }
    try {
      await api.post(`/admin/products/${id}/variants/bulk`, {
        variants: quickVariants.map((variant) => ({
          size_id: variant.size_id,
          color_id: variant.color_id,
          sku: variant.sku.trim(),
          price: variant.price,
          quantity: variant.quantity,
        })),
      });
      message.success(`Đã tạo ${quickVariants.length} biến thể`);
      setQuickModal(false);
      await loadProduct(id);
      onChanged();
    } catch (e) {
      message.error(`Không tạo được biến thể: ${errMsg(e)}`);
    }
  };

  const uploadImage = async ({ file, onError, onSuccess }) => {
    const body = new FormData();
    body.append('file', file);
    try {
      const response = await api.post('/admin/upload', body);
      onSuccess(response.data);
    } catch (error) {
      onError(error);
      message.error(`Không tải được ảnh: ${errMsg(error)}`);
    }
  };

  const addExternalImage = () => {
    const url = externalImage.trim();
    if (!url) return;
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
    } catch {
      message.error('Vui lòng nhập đường dẫn ảnh bắt đầu bằng http:// hoặc https://');
      return;
    }
    setImageList((current) => [...current, {
      uid: `external-${Date.now()}-${current.length}`,
      name: url.split('/').pop() || 'Ảnh bên ngoài',
      status: 'done',
      url,
      response: { url },
    }]);
    setExternalImage('');
  };

  const infoTab = (
    <Form form={infoForm} layout="vertical">
      <Form.Item name="name" label="Tên sản phẩm" rules={[{ required: true, message: 'Bắt buộc nhập' }]}>
        <Input />
      </Form.Item>
      <Space style={{ width: '100%' }} size="middle" wrap>
        <Form.Item name="category_id" label="Danh mục" rules={[{ required: true, message: 'Chọn danh mục' }]}>
          <Select style={{ width: 200 }} options={meta.categories.map((c) => ({ value: c.id, label: c.name }))} />
        </Form.Item>
        <Form.Item name="brand_id" label="Thương hiệu">
          <Select allowClear style={{ width: 200 }} options={meta.brands.map((b) => ({ value: b.id, label: b.name }))} />
        </Form.Item>
        <Form.Item name="base_price" label="Giá gốc (₫)" rules={[{ required: true }]}>
          <InputNumber min={0} step={1000} style={{ width: 160 }} />
        </Form.Item>
        <Form.Item name="status" label="Trạng thái">
          <Select style={{ width: 140 }}
            options={Object.entries(PRODUCT_STATUS).map(([value, v]) => ({ value, label: v.text }))} />
        </Form.Item>
      </Space>
      <Form.Item name="description" label="Mô tả"><Input.TextArea rows={4} /></Form.Item>
      <Form.Item label="Ảnh sản phẩm (ảnh đầu tiên là ảnh chính)">
        <Upload
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          listType="picture-card"
          fileList={imageList}
          customRequest={uploadImage}
          onChange={({ fileList }) => setImageList(fileList.map((file) => ({
            ...file,
            url: file.response?.url || file.url,
          })))}
          onPreview={(file) => setPreviewImage(file.url || file.response?.url)}
          beforeUpload={(file) => {
            const extensionOk = /\.(jpe?g|png|webp)$/i.test(file.name);
            const mimeOk = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
            if (!extensionOk || !mimeOk) {
              message.error('Chỉ chấp nhận ảnh JPG, PNG hoặc WebP đúng định dạng.');
              return Upload.LIST_IGNORE;
            }
            if (file.size > 5 * 1024 * 1024) {
              message.error('Ảnh tải lên không được vượt quá 5 MB.');
              return Upload.LIST_IGNORE;
            }
            return true;
          }}
        >
          <button type="button" className="upload-add-button">
            <PlusOutlined />
            <span>Tải ảnh</span>
          </button>
        </Upload>
        <Space.Compact style={{ width: '100%', maxWidth: 480 }}>
          <Input
            value={externalImage}
            placeholder="Hoặc dán URL ảnh https://..."
            onChange={(event) => setExternalImage(event.target.value)}
            onPressEnter={addExternalImage}
          />
          <Button onClick={addExternalImage}>Thêm link</Button>
        </Space.Compact>
      </Form.Item>
      {previewImage && (
        <Modal open onCancel={() => setPreviewImage('')} footer={null} width={640} destroyOnHidden>
          <Image src={previewImage} style={{ width: '100%' }} />
        </Modal>
      )}
      <Button type="primary" onClick={saveInfo}>{id ? 'Lưu thay đổi' : 'Tạo sản phẩm'}</Button>
    </Form>
  );

  const variantsTab = (
    <>
      <Space style={{ marginBottom: 12 }} wrap>
        <Button type="primary" onClick={() => openVariant()}>Thêm biến thể</Button>
        <Button onClick={openQuickCreate}>Tạo nhanh nhiều biến thể</Button>
      </Space>
      <Table rowKey="id" size="small" pagination={false} dataSource={product?.variants || []}
        columns={[
          { title: 'SKU', dataIndex: 'sku' },
          { title: 'Size', dataIndex: 'size_name' },
          { title: 'Màu', dataIndex: 'color_name' },
          { title: 'Giá', dataIndex: 'price', render: money },
          { title: 'Tồn kho', dataIndex: 'stock',
            render: (s) => <Tag color={s === 0 ? 'red' : s <= 5 ? 'orange' : 'green'}>{s}</Tag> },
          { title: 'Bán', dataIndex: 'is_active',
            render: (a, v) => <Switch size="small" checked={!!a} onChange={(c) => toggleActive(v, c)} /> },
          { title: '', render: (_, v) => (
            <Space>
              <Button size="small" onClick={() => openVariant(v)}>Sửa</Button>
              <Button size="small" onClick={() => { stockForm.resetFields(); stockForm.setFieldsValue({ type: 'IMPORT' }); setStockModal(v); }}>
                Kho
              </Button>
            </Space>
          ) },
        ]} />
    </>
  );

  return (
    <Drawer open={open} onClose={onClose} width={760} destroyOnClose
      title={id ? `Sản phẩm #${id}` : 'Thêm sản phẩm'}>
      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: 'info', label: 'Thông tin', children: infoTab },
        { key: 'variants', label: 'Biến thể & kho', disabled: !id, children: variantsTab },
      ]} />

      <Modal open={!!variantModal} title={variantModal?.id ? 'Sửa biến thể' : 'Thêm biến thể'}
        okText="Lưu" cancelText="Hủy" onOk={saveVariant} onCancel={() => setVariantModal(null)} destroyOnHidden>
        <Form form={variantForm} layout="vertical">
          {!variantModal?.id && (
            <Space>
              <Form.Item name="size_id" label="Size" rules={[{ required: true, message: 'Chọn size' }]}>
                <Select style={{ width: 140 }} options={meta.sizes.map((s) => ({ value: s.id, label: s.name }))} />
              </Form.Item>
              <Form.Item name="color_id" label="Màu" rules={[{ required: true, message: 'Chọn màu' }]}>
                <Select style={{ width: 160 }} options={meta.colors.map((c) => ({ value: c.id, label: c.name }))} />
              </Form.Item>
            </Space>
          )}
          <Form.Item name="sku" label="SKU (mã duy nhất)" rules={[{ required: true, message: 'Bắt buộc nhập' }]}>
            <Input />
          </Form.Item>
          <Space>
            <Form.Item name="price" label="Giá bán (₫)" rules={[{ required: true }]}>
              <InputNumber min={0} step={1000} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="compare_at_price" label="Giá gốc gạch ngang">
              <InputNumber min={0} step={1000} style={{ width: 160 }} />
            </Form.Item>
          </Space>
          {!variantModal?.id && (
            <Form.Item name="quantity" label="Số lượng nhập kho ban đầu"><InputNumber min={0} /></Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        open={quickModal}
        title="Tạo nhanh nhiều biến thể"
        okText={`Tạo ${quickVariants.length} biến thể`}
        cancelText="Hủy"
        okButtonProps={{ disabled: !quickVariants.length }}
        onOk={saveQuickVariants}
        onCancel={() => setQuickModal(false)}
        width={720}
        destroyOnHidden
      >
        <Form form={quickForm} layout="vertical">
          <Space style={{ width: '100%' }} align="start" wrap>
            <Form.Item name="size_ids" label="Chọn nhiều size"
              rules={[{ required: true, message: 'Chọn ít nhất một size' }]}>
              <Select mode="multiple" style={{ minWidth: 200 }} options={meta.sizes.map((size) => ({
                value: size.id, label: size.name,
              }))} />
            </Form.Item>
            <Form.Item name="color_ids" label="Chọn nhiều màu"
              rules={[{ required: true, message: 'Chọn ít nhất một màu' }]}>
              <Select mode="multiple" style={{ minWidth: 200 }} options={meta.colors.map((color) => ({
                value: color.id, label: color.name,
              }))} />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} align="start" wrap>
            <Form.Item name="price" label="Giá chung (₫)" rules={[{ required: true, message: 'Nhập giá bán' }]}>
              <InputNumber min={0} step={1000} style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="quantity" label="Số lượng ban đầu cho mỗi biến thể"
              rules={[{ required: true, message: 'Nhập số lượng ban đầu' }]}>
              <InputNumber min={0} precision={0} style={{ width: 240 }} />
            </Form.Item>
            <Button style={{ marginTop: 30 }} onClick={generateQuickVariants}>Tạo danh sách SKU</Button>
          </Space>
        </Form>
        <Table
          rowKey={(variant) => `${variant.size_id}-${variant.color_id}`}
          size="small"
          pagination={false}
          dataSource={quickVariants}
          scroll={{ y: 300, x: 520 }}
          columns={[
            { title: 'Size', dataIndex: 'size_name' },
            { title: 'Màu', dataIndex: 'color_name' },
            { title: 'SKU (có thể sửa)', dataIndex: 'sku', render: (sku, variant, index) => (
              <Input value={sku} onChange={(event) => setQuickVariants((current) => current.map((item, itemIndex) => (
                itemIndex === index ? { ...item, sku: event.target.value } : item
              )))} />
            ) },
          ]}
        />
      </Modal>

      <Modal open={!!stockModal} title={`Kho: ${stockModal?.sku || ''} (hiện có ${stockModal?.stock ?? 0})`}
        okText="Cập nhật" cancelText="Hủy" onOk={saveStock} onCancel={() => setStockModal(null)} destroyOnHidden>
        <Form form={stockForm} layout="vertical">
          <Form.Item name="type" label="Thao tác">
            <Radio.Group options={[
              { value: 'IMPORT', label: 'Nhập thêm' },
              { value: 'EXPORT', label: 'Xuất bớt' },
              { value: 'ADJUSTMENT', label: 'Đặt lại số lượng' },
            ]} />
          </Form.Item>
          <Form.Item name="quantity" label="Số lượng" rules={[{ required: true, message: 'Nhập số lượng' }]}>
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú"><Input /></Form.Item>
        </Form>
      </Modal>
    </Drawer>
  );
}
