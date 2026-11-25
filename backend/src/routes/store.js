// Thông tin cửa hàng (công khai): app dùng cho màn Liên hệ, nút "Liên hệ cửa hàng" ở đơn hàng và chính sách đổi trả.
// Chỉ đọc biến môi trường, không đụng database. Trường chưa cấu hình trả về null.
const router = require('express').Router();
const { storeInfo } = require('../services/storeConfig');

router.get('/', (req, res) => res.json(storeInfo()));

module.exports = router;
