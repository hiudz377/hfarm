// Thêm/sửa sản phẩm. Tab 1: thông tin chung. Tab 2: mẫu mã (size/màu/SKU/giá) và tồn kho.
import { useEffect, useState } from 'react';
import {
  App, Button, Drawer, Form, Image, Input, InputNumber, Modal, Radio, Select, Space, Switch, Table,
  Tabs, Tag, Upload,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import api, { errMsg } from '../api';
import { groupPrice, money, PRODUCT_STATUS, validate } from '../utils';

// Mua nhóm chưa cấu hình; bật lần đầu thì điền sẵn 2 bậc theo ví dụ: 3 người giảm 10%, 5 người giảm 20%
const DEFAULT_GROUP = { enabled: false, hours: 48, tiers: [] };
const EXAMPLE_TIERS = [{ min_members: 3, discount_percent: 10 }, { min_members: 5, discount_percent: 20 }];

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
  const [meta, setMeta] = useState({ categories: [], brands: [], sizes: [], colors: [], stylist: null });
  const [tab, setTab] = useState('info');
  const [imageList, setImageList] = useState([]);
  const [groupCfg, setGroupCfg] = useState(DEFAULT_GROUP);
  const [groupSaving, setGroupSaving] = useState(false);
  const [externalImage, setExternalImage] = useState('');
  const [previewImage, setPreviewImage] = useState('');
  const [infoForm] = Form.useForm();
  const basePrice = Form.useWatch('base_price', infoForm);
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
    setGroupCfg(p.group_buy ? { enabled: !!p.group_buy.enabled, hours: p.group_buy.hours ?? 48, tiers: p.group_buy.tiers ?? [] } : DEFAULT_GROUP);
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
    setGroupCfg(DEFAULT_GROUP);
    setExternalImage('');
    infoForm.resetFields();
    infoForm.setFieldsValue({ status: 'DRAFT', base_price: 0, styles: [], occasions: [] });
    (async () => {
      try {
        const [categories, brands, sizes, colors] = await Promise.all(
          ['categories', 'brands', 'sizes', 'colors'].map((k) => api.get(`/admin/${k}`).then((r) => r.data)));
        // Lựa chọn của Stylist: lỗi thì chỉ ẩn mục gắn thẻ, không làm hỏng ngăn sản phẩm
        const stylist = await api.get('/stylist/options').then((r) => r.data).catch(() => null);
        setMeta({ categories, brands, sizes, colors, stylist });
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
    const values = await validate(infoForm);
    if (!values) return;
    if (imageList.some((image) => image.status === 'uploading')) {
      message.warning('Vui lòng đợi tải ảnh hoàn tất trước khi lưu.');
      return;
    }
    values.images = imageList
      .filter((image) => image.status === 'done')
      .map((image) => image.response?.url || image.url)
      .filter(Boolean);
    // Ô xóa trống trả về undefined (bị bỏ khỏi JSON): gửi null / mảng rỗng để backend thật sự xóa thẻ.
    // Mục gắn thẻ đang ẩn (không tải được lựa chọn) thì KHÔNG gửi gì để khỏi xóa nhầm thẻ đã có.
    if (meta.stylist) {
      values.outfit_role = values.outfit_role ?? null;
      values.styles = values.styles ?? [];
      values.occasions = values.occasions ?? [];
    } else {
      delete values.outfit_role; delete values.styles; delete values.occasions;
    }
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
        message.success('Đã tạo sản phẩm. Hãy thêm các mẫu mã (size/màu) ở tab này');
      }
      onChanged();
    } catch (e) { message.error(errMsg(e)); }
  };

  // Mua nhóm lưu riêng (PUT /admin/products/:id/group-buy), không đi cùng nút "Lưu thay đổi" của thông tin chung
  const saveGroup = async () => {
    setGroupSaving(true);
    try {
      const res = await api.put(`/admin/products/${id}/group-buy`, { enabled: groupCfg.enabled, hours: groupCfg.hours, tiers: groupCfg.tiers });
      setGroupCfg({ enabled: res.data.enabled, hours: res.data.hours, tiers: res.data.tiers });
      message.success(res.data.enabled ? 'Đã lưu: sản phẩm này đang mở mua nhóm' : 'Đã lưu: tắt mua nhóm cho sản phẩm này');
      onChanged();
    } catch (e) { message.error(errMsg(e)); } finally { setGroupSaving(false); }
  };
  const setTier = (index, patch) => setGroupCfg((cfg) => ({ ...cfg, tiers: cfg.tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)) }));

  const saveVariant = async () => {
    const values = await validate(variantForm);
    if (!values) return;
    try {
      if (variantModal.id) await api.put(`/admin/products/variants/${variantModal.id}`, values);
      else await api.post(`/admin/products/${id}/variants`, values);
      message.success('Đã lưu mẫu mã');
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
    const values = await validate(stockForm);
    if (!values) return;
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
    const values = await validate(quickForm);
    if (!values) return;
    const count = values.size_ids.length * values.color_ids.length;
    if (count > 100) {
      message.error('Mỗi lần chỉ có thể tạo tối đa 100 mẫu mã.');
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
      message.error('Vui lòng tạo mẫu mã và nhập đầy đủ SKU.');
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
      message.success(`Đã tạo ${quickVariants.length} mẫu mã`);
      setQuickModal(false);
      await loadProduct(id);
      onChanged();
    } catch (e) {
      message.error(`Không tạo được mẫu mã: ${errMsg(e)}`);
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
      <div className="form-grid-3">
        <Form.Item name="category_id" label="Danh mục" rules={[{ required: true, message: 'Chọn danh mục' }]}>
          <Select style={{ width: '100%' }} options={meta.categories.map((c) => ({ value: c.id, label: c.name }))} />
        </Form.Item>
        <Form.Item name="brand_id" label="Thương hiệu">
          <Select allowClear style={{ width: '100%' }} options={meta.brands.map((b) => ({ value: b.id, label: b.name }))} />
        </Form.Item>
        <Form.Item name="base_price" label="Giá gốc (₫)" rules={[{ required: true }]}>
          <InputNumber min={0} step={1000} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="status" label="Trạng thái">
          <Select style={{ width: '100%' }}
            options={Object.entries(PRODUCT_STATUS).map(([value, v]) => ({ value, label: v.text }))} />
        </Form.Item>
      </div>
      <Form.Item name="description" label="Mô tả"><Input.TextArea rows={4} /></Form.Item>
      {meta.stylist && (
        <div className="stylist-box">
          <div className="stylist-title">Gợi ý bộ đồ (Stylist)</div>
          <div className="stylist-help">
            Gắn thẻ để app đưa sản phẩm này vào các bộ đồ gợi ý cho khách. Sản phẩm chưa chọn &quot;Vai trò&quot; sẽ không xuất hiện trong gợi ý.
          </div>
          <div className="form-grid-3">
            <Form.Item name="outfit_role" label="Vai trò trong bộ đồ">
              <Select allowClear placeholder="Chưa gắn thẻ (không phối đồ)" style={{ width: '100%' }}
                options={meta.stylist.roles.map((r) => ({ value: r.value, label: r.label }))} />
            </Form.Item>
            <Form.Item name="styles" label="Phong cách (trống = hợp mọi phong cách)">
              <Select mode="multiple" allowClear style={{ width: '100%' }} placeholder="Chọn một hoặc nhiều"
                options={meta.stylist.styles.map((s) => ({ value: s.value, label: s.label }))} />
            </Form.Item>
            <Form.Item name="occasions" label="Hoàn cảnh (trống = hợp mọi hoàn cảnh)">
              <Select mode="multiple" allowClear style={{ width: '100%' }} placeholder="Chọn một hoặc nhiều"
                options={meta.stylist.occasions.map((o) => ({ value: o.value, label: o.label }))} />
            </Form.Item>
          </div>
        </div>
      )}
      <div className="stylist-box group-box">
        <div className="stylist-title">Mua nhóm</div>
        <div className="stylist-help">
          Khách tạo nhóm và mời bạn bè; đủ số người thì mỗi người trong nhóm được giảm theo bậc cao nhất đạt được. Khách chỉ trả tiền khi
          nhóm chốt thành công và bấm mua (không thu trước).
        </div>
        {!id ? (
          <div className="stylist-help">Hãy lưu sản phẩm trước, rồi mở lại để cấu hình mua nhóm.</div>
        ) : (
          <>
            <Space align="center" wrap style={{ marginBottom: 12 }}>
              <Switch
                checked={groupCfg.enabled}
                aria-label="Cho phép mua nhóm"
                onChange={(enabled) => setGroupCfg((cfg) => ({ ...cfg, enabled, tiers: enabled && !cfg.tiers.length ? EXAMPLE_TIERS : cfg.tiers }))}
              />
              <span>Cho phép mua nhóm</span>
              <span className="stylist-help" style={{ margin: 0 }}>· thời gian rủ bạn</span>
              <InputNumber min={1} max={720} precision={0} value={groupCfg.hours} aria-label="Thời gian rủ bạn (giờ)"
                onChange={(hours) => setGroupCfg((cfg) => ({ ...cfg, hours }))} style={{ width: 90 }} />
              <span>giờ</span>
            </Space>
            {groupCfg.enabled && (
              <div className="group-tiers">
                {groupCfg.tiers.map((t, i) => (
                  <div className="group-tier-row" key={i}>
                    <span>Đủ</span>
                    <InputNumber min={2} max={50} precision={0} value={t.min_members} style={{ width: 70 }} aria-label={`Số người bậc ${i + 1}`}
                      onChange={(v) => setTier(i, { min_members: v })} />
                    <span>người, giảm</span>
                    <InputNumber min={1} max={80} value={t.discount_percent} style={{ width: 80 }} aria-label={`Phần trăm giảm bậc ${i + 1}`}
                      onChange={(v) => setTier(i, { discount_percent: v })} />
                    <span>%</span>
                    {Number(basePrice) > 0 && Number(t.discount_percent) > 0 && (
                      <span className="stylist-help" style={{ margin: 0 }}>
                        = {money(groupPrice(basePrice, t.discount_percent))} / người (giá gốc {money(basePrice)})
                      </span>
                    )}
                    <Button type="text" danger icon={<DeleteOutlined />} aria-label={`Xóa bậc ${i + 1}`}
                      onClick={() => setGroupCfg((cfg) => ({ ...cfg, tiers: cfg.tiers.filter((_, j) => j !== i) }))} />
                  </div>
                ))}
                <Button size="small" icon={<PlusOutlined />} disabled={groupCfg.tiers.length >= 5}
                  onClick={() => setGroupCfg((cfg) => ({ ...cfg, tiers: [...cfg.tiers, { min_members: (cfg.tiers.at(-1)?.min_members ?? 1) + 2, discount_percent: Math.min((cfg.tiers.at(-1)?.discount_percent ?? 0) + 10, 80) }] }))}>
                  Thêm bậc
                </Button>
              </div>
            )}
            <div style={{ margin: '12px 0 14px' }}>
              <Button type="primary" ghost loading={groupSaving} onClick={saveGroup}>Lưu mua nhóm</Button>
            </div>
          </>
        )}
      </div>
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
    </Form>
  );

  const variantsTab = (
    <>
      <Space style={{ marginBottom: 12 }} wrap>
        <Button type="primary" onClick={() => openVariant()}>Thêm mẫu mã</Button>
        <Button onClick={openQuickCreate}>Tạo nhanh nhiều mẫu mã</Button>
      </Space>
      <Table rowKey="id" size="small" pagination={false} dataSource={product?.variants || []}
        columns={[
          { title: 'SKU', dataIndex: 'sku' },
          { title: 'Size', dataIndex: 'size_name' },
          { title: 'Màu', dataIndex: 'color_name', render: (name, v) => (<span><span className="color-dot-sm" style={{ backgroundColor: v.hex_code || '#fff' }} />{name}</span>) },
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
      title={id ? (
        <Space>
          <span>{product?.name || `Sản phẩm #${id}`}</span>
          {product && <Tag color={PRODUCT_STATUS[product.status]?.color} style={{ marginInlineEnd: 0 }}>{PRODUCT_STATUS[product.status]?.text}</Tag>}
        </Space>
      ) : 'Thêm sản phẩm'}
      footer={tab === 'info' ? (
        <div className="drawer-footer">
          <Button onClick={onClose}>Đóng</Button>
          <Button type="primary" onClick={saveInfo}>{id ? 'Lưu thay đổi' : 'Tạo sản phẩm'}</Button>
        </div>
      ) : null}>
      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: 'info', label: 'Thông tin', children: infoTab },
        { key: 'variants', label: 'Mẫu mã & kho', disabled: !id, children: variantsTab },
      ]} />

      <Modal open={!!variantModal} title={variantModal?.id ? 'Sửa mẫu mã' : 'Thêm mẫu mã'}
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
        title="Tạo nhanh nhiều mẫu mã"
        okText={`Tạo ${quickVariants.length} mẫu mã`}
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
            <Form.Item name="quantity" label="Số lượng ban đầu cho mỗi mẫu mã"
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
