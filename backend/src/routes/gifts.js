// Quà tặng: người thân chọn quà cho một bạn nam theo dịp + size + ngân sách, viết thiệp, đặt đơn quà.
// Gợi ý và danh sách lựa chọn là công khai (như Stylist); đặt đơn quà cần đăng nhập.
const router = require('express').Router();
const { wrap } = require('../utils');
const { authenticate } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { listOutfitCandidates } = require('../services/products');
const { giftOptions, buildGifts, parseGiftRequest } = require('../services/gifts');
const { wrapInfo, checkoutGift } = require('../services/giftOrders');

// Dịp (kèm số ngày còn lại), mẫu thiệp, lời chúc gợi ý, phong cách, giới hạn nhập, và gói quà (wrap: null nếu cửa hàng chưa bán)
router.get('/options', wrap(async (req, res) => res.json({ ...giftOptions(), wrap: await wrapInfo() })));

// { occasion, budget, styles?, fit: { mode: 'MEASURE', height_cm, weight_kg, shoe? } | { mode: 'SIZE', top, bottom?, shoe? } }
// -> { profile, size_advice, main: [món], combos: [{ title, total, remaining, items, highlights }], small: [món], notes, empty_reason? }
// POST để số đo không nằm trong URL / nhật ký truy cập. Không lưu gì xuống database. Có giới hạn tần suất vì mỗi lượt đọc cả danh mục.
router.post('/suggestions', rateLimit({ windowMs: 60 * 1000, max: 30, message: 'Bạn nhờ gợi ý quá nhanh, vui lòng thử lại sau ít phút.' }),
  wrap(async (req, res) => {
    const profile = parseGiftRequest(req.body);
    const { products, variants } = await listOutfitCandidates();
    res.json(buildGifts(profile, products, variants));
  }));

// Từ đây cần đăng nhập
router.use(authenticate);

// Đặt đơn quà từ giỏ: { address_id, payment_method: 'BANK_TRANSFER', coupon_code?, customer_note?, gift: { occasion?, card_template?,
// card_message?, sender_name?, hide_prices? } } -> 201 như POST /orders, thêm gift. COD bị từ chối (400).
router.post('/checkout', wrap(async (req, res) => res.status(201).json(await checkoutGift(req.user.id, req.body))));

module.exports = router;
