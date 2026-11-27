// Mua nhóm (khách hàng): tạo nhóm, tham gia bằng mã, rời, hủy, đổi size/màu, xem nhóm của tôi. Logic ở services/groupBuy.js.
// Xem một nhóm (GET /:code) công khai để người được mời xem trước khi đăng nhập; các thao tác còn lại cần đăng nhập.
const router = require('express').Router();
const { wrap } = require('../utils');
const { authenticate } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const groups = require('../services/groupBuy');

// Có đăng nhập thì kèm thông tin của chính mình (me); không có hoặc token sai thì coi là khách xem trước, không báo lỗi
const optionalAuth = (req, res, next) => {
  const hasCredentials = req.headers.authorization || (process.env.AUTH_ENABLED !== 'true' && req.headers['x-dev-role']);
  if (!hasCredentials) return next();
  return authenticate(req, res, () => next());
};

const limiter = rateLimit({ windowMs: 60 * 1000, max: 40, message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.' });

// Các nhóm tôi đang tham gia (khai báo trước /:code)
router.get('/mine', authenticate, wrap(async (req, res) => res.json(await groups.listMyGroups(req.user.id))));

// { product_id, variant_id } -> 201 chi tiết nhóm (tôi là chủ nhóm và thành viên đầu tiên)
router.post('/', authenticate, limiter, wrap(async (req, res) => res.status(201).json(await groups.createGroup(req.user.id, req.body))));

router.get('/:code', optionalAuth, wrap(async (req, res) => res.json(await groups.getGroup(req.params.code, req.user?.id ?? null))));

// { variant_id } -> chi tiết nhóm sau khi tham gia
router.post('/:code/join', authenticate, limiter, wrap(async (req, res) => res.json(await groups.joinGroup(req.user.id, req.params.code, req.body))));

// { variant_id }: đổi size / màu của mình
router.put('/:code/variant', authenticate, limiter, wrap(async (req, res) => res.json(await groups.changeVariant(req.user.id, req.params.code, req.body))));

router.post('/:code/leave', authenticate, wrap(async (req, res) => res.json(await groups.leaveGroup(req.user.id, req.params.code))));

router.post('/:code/cancel', authenticate, wrap(async (req, res) => res.json(await groups.cancelGroup(req.user.id, req.params.code))));

module.exports = router;
