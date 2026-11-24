// Banner trang chủ app mobile (CMS). Chỉ admin (khai báo ở routes/admin/index.js).
const router = require('express').Router();
const db = require('../../db');
const { wrap, httpError } = require('../../utils');

const LINK_TYPES = ['NONE', 'CATEGORY', 'PRODUCT', 'COLLECTION'];
const COLLECTIONS = ['new', 'bestseller', 'sale'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/;

const dateOrNull = (v, label) => {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim();
  if (!DATE_RE.test(s)) throw httpError(400, `${label} không hợp lệ (định dạng YYYY-MM-DD HH:mm)`);
  return s.length === 10 ? `${s} 00:00:00` : s.length === 16 ? `${s}:00` : s;
};

async function validate(body) {
  const title = String(body.title ?? '').trim();
  if (!title || title.length > 150) throw httpError(400, 'Tiêu đề bắt buộc, tối đa 150 ký tự');
  const subtitle = body.subtitle ? String(body.subtitle).trim() : '';
  if (subtitle.length > 250) throw httpError(400, 'Mô tả ngắn tối đa 250 ký tự');
  const image = String(body.image_url ?? '').trim();
  if (!image || image.length > 500 || !/^https?:\/\//i.test(image)) throw httpError(400, 'Hãy tải ảnh banner lên (địa chỉ ảnh phải bắt đầu bằng http)');
  const linkType = body.link_type || 'NONE';
  if (!LINK_TYPES.includes(linkType)) throw httpError(400, 'Kiểu liên kết không hợp lệ');
  let linkValue = null;
  if (linkType === 'CATEGORY' || linkType === 'PRODUCT') {
    if (!/^\d{1,18}$/.test(String(body.link_value ?? ''))) throw httpError(400, linkType === 'CATEGORY' ? 'Hãy chọn danh mục' : 'Hãy nhập mã sản phẩm');
    linkValue = String(body.link_value);
    const [rows] = await db.query(`SELECT 1 FROM ${linkType === 'CATEGORY' ? 'categories' : 'products'} WHERE id = ?`, [linkValue]);
    if (!rows.length) throw httpError(400, linkType === 'CATEGORY' ? 'Danh mục không tồn tại' : 'Sản phẩm không tồn tại');
  } else if (linkType === 'COLLECTION') {
    if (!COLLECTIONS.includes(body.link_value)) throw httpError(400, 'Bộ sưu tập không hợp lệ');
    linkValue = body.link_value;
  }
  const sort = Number(body.sort_order ?? 0);
  if (!Number.isInteger(sort) || sort < -1000 || sort > 1000) throw httpError(400, 'Thứ tự phải là số nguyên');
  const starts = dateOrNull(body.starts_at, 'Ngày bắt đầu');
  const ends = dateOrNull(body.ends_at, 'Ngày kết thúc');
  if (starts && ends && starts > ends) throw httpError(400, 'Ngày kết thúc phải sau ngày bắt đầu');
  return [title, subtitle || null, image, linkType, linkValue, sort, body.is_active === undefined ? 1 : (body.is_active ? 1 : 0), starts, ends];
}

const COLS = 'title=?, subtitle=?, image_url=?, link_type=?, link_value=?, sort_order=?, is_active=?, starts_at=?, ends_at=?';

router.get('/', wrap(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM banners ORDER BY sort_order, id');
  res.json(rows);
}));

router.post('/', wrap(async (req, res) => {
  const v = await validate(req.body || {});
  const [r] = await db.query(
    'INSERT INTO banners (title, subtitle, image_url, link_type, link_value, sort_order, is_active, starts_at, ends_at) VALUES (?,?,?,?,?,?,?,?,?)', v);
  res.status(201).json({ id: r.insertId });
}));

router.put('/:id', wrap(async (req, res) => {
  const v = await validate(req.body || {});
  const [r] = await db.query(`UPDATE banners SET ${COLS} WHERE id = ?`, [...v, req.params.id]);
  if (!r.affectedRows) throw httpError(404, 'Không tìm thấy banner');
  res.json({ message: 'Đã lưu banner' });
}));

router.delete('/:id', wrap(async (req, res) => {
  const [r] = await db.query('DELETE FROM banners WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) throw httpError(404, 'Không tìm thấy banner');
  res.json({ message: 'Đã xóa banner' });
}));

module.exports = router;
