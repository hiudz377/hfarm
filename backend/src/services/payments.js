// Thanh toán chuyển khoản: mã VietQR, nhận webhook ngân hàng, xác nhận tay trong CMS, tự hủy đơn quá hạn.
const QRCode = require('qrcode');
const db = require('../db');
const { httpError, tx } = require('../utils');
const { bankConfig } = require('./paymentConfig');
const { changeOrderStatus } = require('./orders');

// ---------------------------------------------------------------------------
// VietQR (chuẩn EMVCo + NAPAS 247, chuyển nhanh tới số tài khoản). Tự sinh tại server, không gọi dịch vụ ngoài.
// ---------------------------------------------------------------------------
const tlv = (id, value) => `${id}${String(value.length).padStart(2, '0')}${value}`;

// CRC-16/CCITT-FALSE (đa thức 0x1021, khởi tạo 0xFFFF), 4 ký tự hex in hoa
function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Chuỗi mà app ngân hàng quét ra: đúng số tiền, đúng nội dung (khách không phải gõ gì)
function buildVietQR({ bin, accountNo, amount, content }) {
  const beneficiary = tlv('00', bin) + tlv('01', accountNo);
  const merchant = tlv('00', 'A000000727') + tlv('01', beneficiary) + tlv('02', 'QRIBFTTA');
  let p = tlv('00', '01') + tlv('01', '12') + tlv('38', merchant) + tlv('53', '704');
  if (amount > 0) p += tlv('54', String(Math.round(amount)));
  p += tlv('58', 'VN');
  if (content) p += tlv('62', tlv('08', content));
  p += '6304';
  return p + crc16(p);
}

// Nội dung chuyển khoản = mã đơn (HT + ngày + 5 số): chỉ chữ và số, ngân hàng không cắt/đổi
const transferContent = (orderCode) => String(orderCode).replace(/[^A-Za-z0-9]/g, '');

// Tìm mã đơn trong nội dung chuyển khoản mà ngân hàng ghi (có thể kèm tiền tố, dấu chấm, khoảng trắng...)
function extractOrderCode(...texts) {
  for (const t of texts) {
    const m = String(t ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').match(/HT\d{13}/);
    if (m) return m[0];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Thông tin thanh toán của một đơn (khách xem để chuyển khoản)
// ---------------------------------------------------------------------------
async function getPaymentInfo(orderId, ownerId) {
  const [rows] = await db.query(
    `SELECT o.id, o.order_code, o.status, o.payment_status, o.total_amount, o.payment_expires_at, o.user_id,
            p.payment_method, (o.payment_expires_at IS NOT NULL AND o.payment_expires_at < NOW()) AS expired,
            TIMESTAMPDIFF(SECOND, NOW(), o.payment_expires_at) AS seconds_left
     FROM orders o LEFT JOIN payments p ON p.order_id = o.id WHERE o.id = ? ORDER BY p.id LIMIT 1`, [orderId]);
  const o = rows[0];
  if (!o || (ownerId && o.user_id !== ownerId)) throw httpError(404, 'Không tìm thấy đơn hàng');
  if (o.payment_method !== 'BANK_TRANSFER') throw httpError(400, 'Đơn này không thanh toán bằng chuyển khoản');

  const bank = bankConfig();
  const closed = ['CANCELLED', 'RETURNED'].includes(o.status);
  // Chỉ cấp QR khi còn trả được: chưa trả, chưa hủy, chưa quá hạn, cửa hàng đã cấu hình tài khoản
  const payable = o.payment_status === 'UNPAID' && !closed && !o.expired && bank.configured;
  const content = transferContent(o.order_code);
  const payload = payable ? buildVietQR({ bin: bank.bin, accountNo: bank.accountNo, amount: o.total_amount, content }) : null;
  return {
    order_id: o.id,
    order_code: o.order_code,
    order_status: o.status,
    payment_status: o.payment_status,
    amount: o.total_amount,
    // Số giây còn lại tính theo đồng hồ MySQL (app đếm ngược từ lúc nhận, không phụ thuộc giờ máy khách); null = không có hạn
    seconds_left: o.seconds_left === null ? null : Math.max(Number(o.seconds_left), 0),
    expired: !!o.expired,
    payable,
    bank: bank.configured ? { bank_name: bank.bankName, account_no: bank.accountNo, account_name: bank.accountName } : null,
    transfer_content: content,
    qr_payload: payload,
    qr_image: payload ? await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 2, width: 360 }) : null,
  };
}

// ---------------------------------------------------------------------------
// Đánh dấu đã thanh toán (dùng chung cho webhook và nút xác nhận tay). conn: đang trong transaction, order: dòng đã khóa.
// ---------------------------------------------------------------------------
async function markPaid(conn, order, { provider, transactionCode, userId, note }) {
  await conn.query("UPDATE orders SET payment_status = 'PAID', payment_expires_at = NULL WHERE id = ?", [order.id]);
  await conn.query(
    "UPDATE payments SET status = 'PAID', provider = ?, transaction_code = ?, paid_at = NOW() WHERE order_id = ?",
    [provider, transactionCode || null, order.id]);
  // Ghi vào lịch sử đơn (trạng thái giữ nguyên) để khách và nhân viên thấy mốc "đã nhận tiền"
  await conn.query(
    'INSERT INTO order_status_history (order_id, changed_by, old_status, new_status, note) VALUES (?,?,?,?,?)',
    [order.id, userId ?? null, order.status, order.status, note]);
}

const vnd = (n) => `${String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;

// ---------------------------------------------------------------------------
// Tiền về tài khoản (webhook). Chống xử lý trùng theo (provider, provider_tx_id).
// Trả { result: MATCHED | UNMATCHED | AMOUNT_MISMATCH | ORDER_CLOSED | ALREADY_PAID | DUPLICATE, order_code? }
// ---------------------------------------------------------------------------
async function processIncomingTransfer({ provider, txId, accountNumber, amount, content, code, time, raw }) {
  txId = String(txId ?? '').trim();
  amount = Number(amount);
  if (!txId || txId.length > 100) throw httpError(400, 'Thiếu mã giao dịch');
  if (!Number.isFinite(amount) || amount <= 0) throw httpError(400, 'Số tiền không hợp lệ');

  const orderCode = extractOrderCode(code, content);
  const bank = bankConfig();
  const wrongAccount = !!accountNumber && bank.configured && String(accountNumber).trim() !== bank.accountNo;
  const when = time && !Number.isNaN(Date.parse(time)) ? String(time).replace('T', ' ').slice(0, 19) : null;

  return tx(async (conn) => {
    // Ghi giao dịch trước: trùng khóa = đã xử lý rồi (nhà cung cấp gửi lại) -> không làm gì thêm
    let rowId;
    try {
      const [ins] = await conn.query(
        `INSERT INTO bank_transactions (provider, provider_tx_id, account_number, amount, content, transaction_time, match_status, raw)
         VALUES (?,?,?,?,?,?, 'UNMATCHED', ?)`,
        [provider, txId, accountNumber ? String(accountNumber).slice(0, 40) : null, amount,
          content ? String(content).slice(0, 500) : null, when, JSON.stringify(raw ?? null)]);
      rowId = ins.insertId;
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return { result: 'DUPLICATE' };
      throw e;
    }

    const finish = async (result, orderId, note, resolved = false) => {
      await conn.query('UPDATE bank_transactions SET match_status = ?, order_id = ?, note = ?, resolved = ? WHERE id = ?',
        [result, orderId ?? null, note ?? null, resolved ? 1 : 0, rowId]);
      return { result, order_code: orderCode };
    };

    if (wrongAccount) return finish('UNMATCHED', null, 'Giao dịch vào tài khoản khác với tài khoản cửa hàng đã cấu hình');
    if (!orderCode) return finish('UNMATCHED', null, 'Không tìm thấy mã đơn trong nội dung chuyển khoản');

    const [orders] = await conn.query('SELECT * FROM orders WHERE order_code = ? FOR UPDATE', [orderCode]);
    const order = orders[0];
    if (!order) return finish('UNMATCHED', null, `Không có đơn hàng mã ${orderCode}`);
    const [pays] = await conn.query('SELECT payment_method FROM payments WHERE order_id = ? ORDER BY id LIMIT 1', [order.id]);
    if (!pays.length || pays[0].payment_method !== 'BANK_TRANSFER') {
      return finish('UNMATCHED', order.id, 'Đơn này không chọn thanh toán chuyển khoản');
    }
    if (order.payment_status === 'PAID') {
      return finish('ALREADY_PAID', order.id, `Đơn đã thanh toán trước đó; khoản ${vnd(amount)} này có thể là chuyển trùng, cần hoàn lại cho khách`);
    }
    if (['CANCELLED', 'RETURNED'].includes(order.status)) {
      return finish('ORDER_CLOSED', order.id, `Đơn đã ${order.status === 'CANCELLED' ? 'hủy' : 'hoàn trả'} (có thể quá hạn thanh toán); cần hoàn ${vnd(amount)} cho khách`);
    }

    // Khách chuyển thiếu rồi chuyển bù: cộng dồn các khoản thiếu trước đó của đơn này
    const [[{ earlier }]] = await conn.query(
      "SELECT COALESCE(SUM(amount), 0) AS earlier FROM bank_transactions WHERE order_id = ? AND match_status = 'AMOUNT_MISMATCH' AND resolved = 0 AND id <> ?",
      [order.id, rowId]);
    const received = Number(earlier) + amount;
    if (received < order.total_amount) {
      return finish('AMOUNT_MISMATCH', order.id, `Chuyển thiếu: nhận ${vnd(received)} / cần ${vnd(order.total_amount)}`);
    }

    await markPaid(conn, order, {
      provider, transactionCode: txId, userId: null,
      note: 'Đã nhận chuyển khoản qua ngân hàng',
    });
    await conn.query("UPDATE bank_transactions SET resolved = 1 WHERE order_id = ? AND match_status = 'AMOUNT_MISMATCH'", [order.id]);
    const over = received - order.total_amount;
    return finish('MATCHED', order.id, over > 0 ? `Khách chuyển dư ${vnd(over)}, cần hoàn lại` : null, over <= 0);
  });
}

// ---------------------------------------------------------------------------
// Nhân viên xác nhận đã nhận tiền (CMS)
// ---------------------------------------------------------------------------
async function confirmPaymentManually(orderId, userId, { transaction_code, note } = {}) {
  return tx(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    const order = rows[0];
    if (!order) throw httpError(404, 'Không tìm thấy đơn hàng');
    const [pays] = await conn.query('SELECT payment_method FROM payments WHERE order_id = ? ORDER BY id LIMIT 1', [orderId]);
    if (!pays.length || pays[0].payment_method === 'COD') throw httpError(400, 'Đơn thanh toán khi nhận hàng được thu tiền lúc giao, không cần xác nhận');
    if (order.payment_status === 'PAID') throw httpError(400, 'Đơn này đã được xác nhận thanh toán');
    if (order.payment_status !== 'UNPAID') throw httpError(400, 'Đơn đã hoàn tiền hoặc thanh toán lỗi, không xác nhận được');
    if (['CANCELLED', 'RETURNED'].includes(order.status)) throw httpError(400, 'Đơn đã hủy hoặc hoàn trả nên không nhận thanh toán được');
    const code = transaction_code == null ? '' : String(transaction_code).trim();
    if (code.length > 150) throw httpError(400, 'Mã giao dịch tối đa 150 ký tự');
    const extra = note == null ? '' : String(note).trim();
    if (extra.length > 300) throw httpError(400, 'Ghi chú tối đa 300 ký tự');
    await markPaid(conn, order, {
      provider: 'MANUAL', transactionCode: code, userId,
      note: `Nhân viên xác nhận đã nhận tiền${extra ? `: ${extra}` : ''}`,
    });
    // Các khoản chuyển thiếu của đơn này coi như đã xử lý
    await conn.query("UPDATE bank_transactions SET resolved = 1 WHERE order_id = ? AND match_status = 'AMOUNT_MISMATCH'", [orderId]);
    return { payment_status: 'PAID' };
  });
}

// ---------------------------------------------------------------------------
// Tự hủy đơn chuyển khoản quá hạn chưa trả (hoàn kho + hoàn lượt mã giảm giá nhờ changeOrderStatus)
// Chỉ đơn còn PENDING: nhân viên đã xác nhận đơn thì để nhân viên quyết định.
// ---------------------------------------------------------------------------
async function expireUnpaidTransfers(limit = 50) {
  const [due] = await db.query(
    `SELECT id, order_code FROM orders
     WHERE status = 'PENDING' AND payment_status = 'UNPAID' AND payment_expires_at IS NOT NULL AND payment_expires_at < NOW()
     ORDER BY payment_expires_at LIMIT ?`, [limit]);
  let cancelled = 0;
  for (const o of due) {
    try {
      await changeOrderStatus(o.id, 'CANCELLED', null, 'Quá hạn thanh toán chuyển khoản', { requireUnpaid: true });
      cancelled += 1;
    } catch (e) {
      // 409/400: tiền vừa về hoặc đơn vừa đổi trạng thái: bỏ qua. Lỗi khác thì ghi log và đi tiếp.
      if (!e.status) console.error(`Không hủy được đơn quá hạn ${o.order_code}:`, e);
    }
  }
  return cancelled;
}

// ---------------------------------------------------------------------------
// Giao dịch ngân hàng cần nhân viên xử lý (không khớp đơn, thiếu/dư tiền, đơn đã hủy...)
// ---------------------------------------------------------------------------
async function listBankTransactions({ resolved, limit, offset }) {
  const where = resolved === undefined ? '' : 'WHERE t.resolved = ?';
  const params = resolved === undefined ? [] : [resolved ? 1 : 0];
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM bank_transactions t ${where}`, params);
  const [rows] = await db.query(
    `SELECT t.id, t.provider, t.provider_tx_id, t.amount, t.content, t.transaction_time, t.match_status, t.note, t.resolved,
            t.created_at, t.order_id, o.order_code, o.total_amount AS order_total, o.status AS order_status
     FROM bank_transactions t LEFT JOIN orders o ON o.id = t.order_id ${where}
     ORDER BY t.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { data: rows, total };
}

async function resolveBankTransaction(id) {
  const [r] = await db.query('UPDATE bank_transactions SET resolved = 1 WHERE id = ?', [id]);
  if (!r.affectedRows) throw httpError(404, 'Không tìm thấy giao dịch');
}

module.exports = {
  buildVietQR, crc16, extractOrderCode, transferContent, getPaymentInfo, processIncomingTransfer,
  confirmPaymentManually, expireUnpaidTransfers, listBankTransactions, resolveBankTransaction,
};
