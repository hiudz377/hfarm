// Giao hàng (công khai): ước tính phí/thời gian giao + tra cứu hành trình theo mã vận đơn
const router = require('express').Router();
const db = require('../db');
const { wrap } = require('../utils');
const { rateLimit } = require('../middleware/rateLimit');
const { feeFor } = require('../services/shipping');
const { getPublicTracking } = require('../services/tracking');

// ?province=Hà Nội&subtotal=300000 -> { zone_name, fee, free_over, eta_min_days, eta_max_days }. Bỏ province = vùng mặc định.
router.get('/shipping/estimate', wrap(async (req, res) => {
  const subtotal = Math.max(Number(req.query.subtotal) || 0, 0);
  res.json(await feeFor(db, req.query.province, subtotal));
}));

// Tra cứu theo mã vận đơn: giới hạn tần suất để không dò mã hàng loạt
router.get('/tracking/:code', rateLimit({ windowMs: 60 * 1000, max: 30, message: 'Bạn tra cứu quá nhanh, vui lòng thử lại sau ít phút.' }),
  wrap(async (req, res) => res.json(await getPublicTracking(req.params.code))));

module.exports = router;
