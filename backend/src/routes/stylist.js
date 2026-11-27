// Stylist cá nhân (công khai, không cần đăng nhập): khách nhập số đo, phong cách, hoàn cảnh, ngân sách -> nhận các bộ đồ hoàn chỉnh.
// Không lưu gì xuống database (chiều cao, cân nặng chỉ dùng để tính trong lúc xử lý). Mua hàng vẫn đi qua giỏ hàng như bình thường.
const router = require('express').Router();
const { wrap } = require('../utils');
const { rateLimit } = require('../middleware/rateLimit');
const { listOutfitCandidates } = require('../services/products');
const { buildOutfits, parseProfile, stylistOptions } = require('../services/stylist');

// Các lựa chọn (giới tính, phong cách, hoàn cảnh, vai trò...) để app và CMS dùng chung một danh sách
router.get('/options', (req, res) => res.json(stylistOptions()));

// { height_cm, weight_kg, styles: [..1-3 mã..], occasion, budget }   (cửa hàng chỉ bán đồ nam: không có giới tính)
// -> { profile, size_advice, outfits: [{ key, label, total, remaining, items, highlights, skipped }], notes, empty_reason? }
// POST (không phải GET) để số đo của khách không nằm trong URL / nhật ký truy cập. Có giới hạn tần suất vì mỗi lượt đọc cả danh mục.
router.post('/outfits', rateLimit({ windowMs: 60 * 1000, max: 30, message: 'Bạn nhờ gợi ý quá nhanh, vui lòng thử lại sau ít phút.' }),
  wrap(async (req, res) => {
    const profile = parseProfile(req.body);
    const { products, variants } = await listOutfitCandidates();
    res.json(buildOutfits(profile, products, variants));
  }));

module.exports = router;
