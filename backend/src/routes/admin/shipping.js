// Phí vận chuyển theo vùng + giao dịch ngân hàng cần xử lý (CMS)
// Staff được xem; chỉ admin được thêm/sửa/xóa vùng (khai báo ở routes/admin/index.js)
const router = require('express').Router();
const db = require('../../db');
const { wrap, httpError, paging } = require('../../utils');
const { loadZones, validateZone } = require('../../services/shipping');
const { listBankTransactions, resolveBankTransaction } = require('../../services/payments');

// ---- Vùng vận chuyển ----
router.get('/shipping-zones', wrap(async (req, res) => res.json(await loadZones(db, { onlyActive: false }))));

const cols = (z) => [z.name, z.provinces ? JSON.stringify(z.provinces) : null, z.is_default, z.fee, z.free_over, z.eta_min_days, z.eta_max_days, z.is_active];

// Luôn có đúng MỘT vùng mặc định (đã tạo sẵn): không tạo thêm, không đổi, không xóa, không tắt. Muốn đổi phí mặc định thì sửa chính vùng đó.
router.post('/shipping-zones', wrap(async (req, res) => {
  const z = validateZone({ ...req.body, is_default: false }, await loadZones(db, { onlyActive: false }));
  const [r] = await db.query(
    `INSERT INTO shipping_zones (name, provinces, is_default, fee, free_over, eta_min_days, eta_max_days, is_active) VALUES (?,?,?,?,?,?,?,?)`, cols(z));
  res.status(201).json({ id: r.insertId });
}));

router.put('/shipping-zones/:id', wrap(async (req, res) => {
  const zones = await loadZones(db, { onlyActive: false });
  const cur = zones.find((z) => String(z.id) === String(req.params.id));
  if (!cur) throw httpError(404, 'Không tìm thấy vùng vận chuyển');
  const z = validateZone(
    { ...req.body, is_default: !!cur.is_default, is_active: cur.is_default ? true : req.body.is_active },
    zones.filter((o) => o.id !== cur.id));
  await db.query(
    `UPDATE shipping_zones SET name=?, provinces=?, is_default=?, fee=?, free_over=?, eta_min_days=?, eta_max_days=?, is_active=? WHERE id=?`,
    [...cols(z), cur.id]);
  res.json({ message: 'Đã lưu vùng vận chuyển' });
}));

router.delete('/shipping-zones/:id', wrap(async (req, res) => {
  const [rows] = await db.query('SELECT is_default FROM shipping_zones WHERE id = ?', [req.params.id]);
  if (!rows.length) throw httpError(404, 'Không tìm thấy vùng vận chuyển');
  if (rows[0].is_default) throw httpError(400, 'Không xóa được vùng mặc định');
  await db.query('DELETE FROM shipping_zones WHERE id = ?', [req.params.id]);
  res.json({ message: 'Đã xóa vùng vận chuyển' });
}));

// ---- Giao dịch ngân hàng (nhận qua webhook) ----
// ?resolved=0 (cần xử lý) | 1 (đã xử lý) | bỏ trống (tất cả); &page=&limit=
router.get('/bank-transactions', wrap(async (req, res) => {
  const { page, limit, offset } = paging(req.query);
  const resolved = req.query.resolved === undefined || req.query.resolved === '' ? undefined : req.query.resolved === '1';
  const { data, total } = await listBankTransactions({ resolved, limit, offset });
  res.json({ data, page, limit, total });
}));

router.patch('/bank-transactions/:id/resolve', wrap(async (req, res) => {
  await resolveBankTransaction(req.params.id);
  res.json({ message: 'Đã đánh dấu đã xử lý' });
}));

module.exports = router;
