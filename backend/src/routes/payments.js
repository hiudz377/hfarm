// Thanh toán (công khai): phương thức đang bật + webhook nhận tiền từ ngân hàng
const crypto = require('crypto');
const router = require('express').Router();
const { wrap, httpError } = require('../utils');
const { rateLimit } = require('../middleware/rateLimit');
const { bankConfig, holdMinutes, webhookKey } = require('../services/paymentConfig');
const { processIncomingTransfer } = require('../services/payments');

// App chỉ hiện các phương thức server đang hỗ trợ (chuyển khoản chỉ bật khi đã đặt BANK_* trong .env).
// BANK_TRANSFER kèm hold_minutes (hạn trả) và auto_confirm (true = webhook ngân hàng đã bật nên đơn tự cập nhật khi tiền về;
// false = nhân viên xác nhận tay): app dựa vào đây để nói đúng với khách.
router.get('/methods', wrap(async (req, res) => {
  const methods = [{ value: 'COD' }];
  if (bankConfig().configured) methods.push({ value: 'BANK_TRANSFER', hold_minutes: holdMinutes(), auto_confirm: !!webhookKey() });
  res.json({ methods });
}));

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();

// Webhook của SePay (https://developer.sepay.vn): header "Authorization: Apikey <PAYMENT_WEBHOOK_KEY>", body JSON có
// id, transferType ("in"/"out"), transferAmount, content, code, accountNumber, transactionDate.
// Chưa đặt PAYMENT_WEBHOOK_KEY thì tắt hẳn (503). Phản hồi { success: true } để SePay không gửi lại.
router.post('/webhook/sepay', rateLimit({ windowMs: 60 * 1000, max: 120 }), wrap(async (req, res) => {
  const key = webhookKey();
  if (!key) throw httpError(503, 'Webhook thanh toán chưa được bật');
  const m = /^Apikey\s+(.+)$/i.exec(req.get('authorization') || '');
  if (!m || !crypto.timingSafeEqual(sha(m[1].trim()), sha(key))) throw httpError(401, 'Khóa webhook không đúng');

  const b = req.body || {};
  if (b.transferType !== 'in') return res.json({ success: true, ignored: 'Không phải giao dịch tiền vào' });
  const out = await processIncomingTransfer({
    provider: 'SEPAY', txId: b.id ?? b.referenceCode, accountNumber: b.accountNumber, amount: b.transferAmount,
    content: b.content, code: b.code, time: b.transactionDate, raw: b,
  });
  res.json({ success: true, result: out.result });
}));

module.exports = router;
