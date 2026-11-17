// Tất cả route /api/admin/* (đã được bảo vệ bằng role admin/staff ở index.js)
const router = require('express').Router();

router.use(require('./attributes'));
router.use(require('./upload'));
router.use('/products', require('./products'));
router.use('/inventory', require('./inventory'));
router.use('/orders', require('./orders'));
router.use(require('./misc'));

module.exports = router;
