// Khách gửi đánh giá cho món hàng trong đơn đã hoàn thành
const router = require('express').Router();
const { wrap } = require('../utils');
const { authenticate } = require('../middleware/auth');
const { createReview } = require('../services/reviews');

router.use(authenticate);

// { order_item_id, rating: 1-5, comment? } -> 201 { id, status: 'PENDING' } (hiện công khai sau khi nhân viên duyệt)
router.post('/', wrap(async (req, res) => res.status(201).json(await createReview(req.user.id, req.body || {}))));

module.exports = router;
