// CMS: danh sách nhóm mua nhóm + hủy nhóm đang mở (admin, staff). Cấu hình bậc giá nằm ở /api/admin/products/:id/group-buy.
const router = require('express').Router();
const { wrap } = require('../../utils');
const { adminListGroups, cancelGroup } = require('../../services/groupBuy');

// ?status=OPEN|SUCCESS|FAILED|CANCELLED &page= &limit=  ->  { data, page, limit, total }
router.get('/', wrap(async (req, res) => res.json(await adminListGroups(req.query))));

// Chỉ nhóm còn OPEN (nhóm đã chốt thành công thì thành viên đã được hưởng giá nhóm nên không hủy được)
router.post('/:code/cancel', wrap(async (req, res) => res.json(await cancelGroup(req.user.id, req.params.code, { byStaff: true }))));

module.exports = router;
