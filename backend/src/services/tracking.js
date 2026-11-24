// Hành trình giao hàng: gộp các mốc đổi trạng thái đơn (order_status_history) với sự kiện nhân viên ghi (shipment_events).
const db = require('../db');
const { httpError } = require('../utils');

const STATUS_TITLE = {
  CONFIRMED: 'Cửa hàng đã xác nhận đơn hàng',
  PROCESSING: 'Cửa hàng đang chuẩn bị hàng',
  SHIPPING: 'Đã bàn giao cho đơn vị vận chuyển',
  COMPLETED: 'Giao hàng thành công',
  CANCELLED: 'Đơn hàng đã hủy',
  RETURNED: 'Đơn hàng được hoàn trả',
};
// Tracking công khai chỉ nói về vận chuyển, không lộ các bước nội bộ của cửa hàng
const PUBLIC_STATUSES = ['SHIPPING', 'COMPLETED', 'RETURNED'];

async function listEvents(orderId) {
  const [rows] = await db.query(
    `SELECT e.id, e.title, e.location, e.created_at, u.full_name AS created_by_name
     FROM shipment_events e LEFT JOIN users u ON u.id = e.created_by
     WHERE e.order_id = ? ORDER BY e.created_at DESC, e.id DESC`, [orderId]);
  return rows;
}

// Mới nhất trước. kind: 'status' (đổi trạng thái) | 'payment' (đã nhận tiền) | 'event' (nhân viên ghi)
function buildTimeline(history, events, { publicOnly = false } = {}) {
  const items = [];
  // n: số thứ tự trong bảng gốc, chỉ để xếp các mốc cùng giây (TIMESTAMP chỉ chính xác đến giây)
  for (const h of history) {
    if (h.old_status === h.new_status) {
      if (!publicOnly) items.push({ at: h.created_at, kind: 'payment', title: h.note || 'Cập nhật thanh toán', id: `h${h.id}`, n: h.id });
      continue;
    }
    if (h.old_status === null) {
      if (!publicOnly) items.push({ at: h.created_at, kind: 'status', title: 'Đặt hàng thành công', status: 'PENDING', id: `h${h.id}`, n: h.id });
      continue;
    }
    if (publicOnly && !PUBLIC_STATUSES.includes(h.new_status)) continue;
    items.push({
      at: h.created_at, kind: 'status', status: h.new_status, id: `h${h.id}`, n: h.id,
      title: STATUS_TITLE[h.new_status] || h.new_status,
      note: publicOnly ? null : (h.note || null),
    });
  }
  for (const e of events) items.push({ at: e.created_at, kind: 'event', title: e.title, location: e.location || null, id: `e${e.id}`, n: e.id });
  // Mới nhất trước; cùng giây thì mốc nhân viên ghi (đến sau khi đã giao) trước, rồi theo số thứ tự giảm dần
  items.sort((a, b) => new Date(b.at) - new Date(a.at) || (b.kind === 'event') - (a.kind === 'event') || b.n - a.n);
  return items.map(({ n, ...rest }) => rest);
}

// Khách xem hành trình đơn của mình
async function getOrderTracking(orderId, ownerId) {
  const [rows] = await db.query('SELECT id, order_code, status, payment_status, user_id FROM orders WHERE id = ?', [orderId]);
  const o = rows[0];
  if (!o || (ownerId && o.user_id !== ownerId)) throw httpError(404, 'Không tìm thấy đơn hàng');
  const [history] = await db.query('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY id', [orderId]);
  const [ship] = await db.query('SELECT carrier, tracking_code, status, shipped_at, delivered_at FROM shipments WHERE order_id = ?', [orderId]);
  return {
    order_code: o.order_code,
    order_status: o.status,
    shipment: ship[0] || null,
    timeline: buildTimeline(history, await listEvents(orderId)),
  };
}

// "Nguyễn Văn An" -> "N*** An": đủ để người nhận nhận ra, người lạ không biết được tên đầy đủ
function maskName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const last = parts[parts.length - 1];
  return parts.length === 1 ? `${last[0]}***` : `${parts[0][0]}*** ${last}`;
}

// Tra cứu công khai theo mã vận đơn (không cần đăng nhập): không trả số điện thoại, địa chỉ chi tiết, sản phẩm, tiền
async function getPublicTracking(code) {
  const key = String(code || '').trim();
  if (!key || key.length > 150) throw httpError(404, 'Không tìm thấy mã vận đơn');
  const [rows] = await db.query(
    `SELECT s.carrier, s.tracking_code, s.status AS shipment_status, s.shipped_at, s.delivered_at,
            o.id AS order_id, o.status AS order_status, o.recipient_name, o.province
     FROM shipments s JOIN orders o ON o.id = s.order_id WHERE s.tracking_code = ? LIMIT 1`, [key]);
  const r = rows[0];
  if (!r) throw httpError(404, 'Không tìm thấy mã vận đơn');
  const [history] = await db.query('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY id', [r.order_id]);
  return {
    tracking_code: r.tracking_code,
    carrier: r.carrier,
    shipment_status: r.shipment_status,
    order_status: r.order_status,
    shipped_at: r.shipped_at,
    delivered_at: r.delivered_at,
    recipient: maskName(r.recipient_name),
    province: r.province,
    timeline: buildTimeline(history, await listEvents(r.order_id), { publicOnly: true }),
  };
}

// Nhân viên ghi một mốc hành trình (chỉ khi đơn đang giao)
async function addEvent(orderId, userId, { title, location }) {
  const t = String(title ?? '').trim();
  const loc = location == null ? '' : String(location).trim();
  if (!t) throw httpError(400, 'Hãy nhập nội dung hành trình');
  if (t.length > 200) throw httpError(400, 'Nội dung hành trình tối đa 200 ký tự');
  if (loc.length > 150) throw httpError(400, 'Địa điểm tối đa 150 ký tự');
  const [rows] = await db.query('SELECT status FROM orders WHERE id = ?', [orderId]);
  if (!rows.length) throw httpError(404, 'Không tìm thấy đơn hàng');
  if (rows[0].status !== 'SHIPPING') throw httpError(400, 'Chỉ ghi hành trình khi đơn đang giao');
  const [r] = await db.query('INSERT INTO shipment_events (order_id, title, location, created_by) VALUES (?,?,?,?)',
    [orderId, t, loc || null, userId]);
  return { id: r.insertId };
}

async function deleteEvent(orderId, eventId) {
  const [r] = await db.query('DELETE FROM shipment_events WHERE id = ? AND order_id = ?', [eventId, orderId]);
  if (!r.affectedRows) throw httpError(404, 'Không tìm thấy mục hành trình');
}

module.exports = { listEvents, getOrderTracking, getPublicTracking, addEvent, deleteEvent };
