// Mua nhóm (group buy): sản phẩm có các bậc giá "đủ N người thì mỗi người giảm X%". Khách tạo nhóm, gửi mã / link mời bạn bè;
// hết hạn hoặc đủ người thì nhóm CHỐT: đạt ít nhất một bậc -> SUCCESS, mọi thành viên được giảm theo bậc cao nhất đạt được cho
// ĐÚNG mẫu mã (size x màu) mình đã chọn, trong thời hạn claim_until; không đạt bậc nào -> FAILED (mua giá thường như bình thường).
//
// Không thu tiền lúc tham gia (dự án chưa có hoàn tiền tự động): thành viên chỉ trả khi mua. Giảm giá được áp NGAY TRONG
// quoteOrder / createOrder (services/orders.js, hàm groupDiscount ở cuối file này), cùng một hàm cho cả hai nên luôn khớp.
// Tồn kho KHÔNG giữ chỗ khi tham gia (giống giỏ hàng): hết hàng lúc mua thì báo như đơn thường.
//
// Phần tính toán thuần (bậc giá, giá nhóm, mã nhóm) đặt riêng để test không cần database: backend/test/groupBuy.test.js.
const crypto = require('crypto');
const db = require('../db');
const { httpError, tx, paging } = require('../utils');
const { maskName } = require('./reviews');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bỏ I, O, 0, 1 cho dễ đọc / đọc qua điện thoại
const CODE_LENGTH = 8;
const MAX_TIERS = 5;
const MIN_MEMBERS = 2;
const MAX_MEMBERS = 50;
const MAX_PERCENT = 80;
const MAX_OPEN_PER_LEADER = 5; // mỗi người chỉ làm chủ tối đa chừng này nhóm đang mở (chống tạo nhóm tràn lan)
const DEFAULT_HOURS = 48;
const MAX_HOURS = 720;

const claimHours = () => Math.min(Math.max(Number(process.env.GROUP_CLAIM_HOURS) || 24, 1), 168);
const publicUrl = () => (process.env.PUBLIC_URL || 'http://localhost:3000').replace(/\/+$/, '');

// ---------------------------------------------------------------------------
// Phần thuần (không database)
// ---------------------------------------------------------------------------

function generateCode() {
  let s = '';
  for (let i = 0; i < CODE_LENGTH; i++) s += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return s;
}

// Khách gõ "abc-d2ef" hay " ABCD2EF3 " đều được; sai định dạng -> null
function normalizeCode(input) {
  const s = String(input ?? '').toUpperCase().replace(/[\s-]+/g, '');
  return new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(s) ? s : null;
}

// Kiểm tra + chuẩn hóa danh sách bậc giá do CMS gửi: [{ min_members, discount_percent }] -> sắp theo số người
function validateTiers(input) {
  if (!Array.isArray(input) || !input.length) throw httpError(400, 'Cần ít nhất một bậc giá mua nhóm.');
  if (input.length > MAX_TIERS) throw httpError(400, `Tối đa ${MAX_TIERS} bậc giá.`);
  const tiers = input.map((t) => ({
    min_members: Number(t?.min_members),
    discount_percent: Math.round(Number(t?.discount_percent) * 100) / 100,
  }));
  for (const t of tiers) {
    if (!Number.isInteger(t.min_members) || t.min_members < MIN_MEMBERS || t.min_members > MAX_MEMBERS) {
      throw httpError(400, `Số người mỗi bậc phải là số nguyên từ ${MIN_MEMBERS} đến ${MAX_MEMBERS}.`);
    }
    if (!Number.isFinite(t.discount_percent) || t.discount_percent <= 0 || t.discount_percent > MAX_PERCENT) {
      throw httpError(400, `Phần trăm giảm phải lớn hơn 0 và không quá ${MAX_PERCENT}.`);
    }
  }
  tiers.sort((a, b) => a.min_members - b.min_members);
  for (let i = 1; i < tiers.length; i++) {
    if (tiers[i].min_members === tiers[i - 1].min_members) throw httpError(400, 'Hai bậc giá không được cùng số người.');
    if (tiers[i].discount_percent <= tiers[i - 1].discount_percent) throw httpError(400, 'Bậc nhiều người hơn phải giảm nhiều hơn.');
  }
  return tiers;
}

// Bậc cao nhất đã đạt với `count` người (null nếu chưa đạt bậc nào) / bậc kế tiếp (null nếu đã ở bậc cao nhất)
const currentTier = (tiers, count) => tiers.reduce((best, t) => (t.min_members <= count ? t : best), null);
const nextTier = (tiers, count) => tiers.find((t) => t.min_members > count) ?? null;
// Sức chứa = số người của bậc cao nhất: đủ ngần ấy người thì không còn bậc nào để leo nên nhóm chốt ngay
const capacityOf = (tiers) => tiers[tiers.length - 1].min_members;

// Giá mỗi người sau giảm (làm tròn tới đồng) và số tiền được giảm
const groupPrice = (price, percent) => Math.round((Number(price) * (100 - Number(percent))) / 100);
const groupDiscountAmount = (price, percent) => Number(price) - groupPrice(price, percent);

// ---------------------------------------------------------------------------
// Cấu hình mua nhóm của sản phẩm (CMS)
// ---------------------------------------------------------------------------

// { enabled, hours, tiers: [{ min_members, discount_percent }] }. enabled = đã bật VÀ có ít nhất một bậc.
async function getGroupConfig(exec, productId) {
  const [[p]] = await exec.query('SELECT group_buy_enabled, group_buy_hours FROM products WHERE id = ?', [productId]);
  if (!p) return null;
  const [tiers] = await exec.query(
    'SELECT min_members, discount_percent FROM product_group_tiers WHERE product_id = ? ORDER BY min_members', [productId]);
  return { enabled: !!p.group_buy_enabled && tiers.length > 0, hours: p.group_buy_hours, tiers };
}

// body: { enabled, hours?, tiers? }. Tắt thì giữ nguyên các bậc đã nhập để bật lại không phải nhập lại.
async function saveGroupConfig(productId, body = {}) {
  const enabled = body.enabled === true || body.enabled === 1 || body.enabled === 'true';
  const hours = body.hours === undefined || body.hours === null || body.hours === '' ? DEFAULT_HOURS : Number(body.hours);
  if (!Number.isInteger(hours) || hours < 1 || hours > MAX_HOURS) throw httpError(400, `Thời gian rủ bạn phải từ 1 đến ${MAX_HOURS} giờ.`);
  // Tắt mà không gửi bậc (hoặc gửi mảng rỗng) thì chỉ đổi cờ, giữ nguyên các bậc đang lưu
  const tiers = enabled || (Array.isArray(body.tiers) && body.tiers.length) ? validateTiers(body.tiers) : null;
  await tx(async (conn) => {
    const [[p]] = await conn.query('SELECT id FROM products WHERE id = ? FOR UPDATE', [productId]);
    if (!p) throw httpError(404, 'Không tìm thấy sản phẩm');
    await conn.query('UPDATE products SET group_buy_enabled = ?, group_buy_hours = ? WHERE id = ?', [enabled ? 1 : 0, hours, productId]);
    if (tiers) {
      await conn.query('DELETE FROM product_group_tiers WHERE product_id = ?', [productId]);
      for (const t of tiers) {
        await conn.query('INSERT INTO product_group_tiers (product_id, min_members, discount_percent) VALUES (?,?,?)',
          [productId, t.min_members, t.discount_percent]);
      }
    }
  });
  return getGroupConfig(db, productId);
}

// ---------------------------------------------------------------------------
// Nhóm
// ---------------------------------------------------------------------------

const GROUP_SELECT = `SELECT g.*, (g.expires_at <= NOW()) AS due,
       GREATEST(TIMESTAMPDIFF(SECOND, NOW(), g.expires_at), 0) AS seconds_left,
       CASE WHEN g.claim_until IS NULL THEN NULL ELSE GREATEST(TIMESTAMPDIFF(SECOND, NOW(), g.claim_until), 0) END AS claim_seconds_left
     FROM buy_groups g`;

const loadGroup = async (exec, code, lock = false) => {
  const [[g]] = await exec.query(`${GROUP_SELECT} WHERE g.code = ?${lock ? ' FOR UPDATE' : ''}`, [code]);
  return g ?? null;
};

// Chốt nhóm (phải gọi trong transaction, đã khóa dòng nhóm): đạt ít nhất một bậc -> SUCCESS, không thì FAILED
async function finalizeGroup(conn, g) {
  const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM buy_group_members WHERE group_id = ?', [g.id]);
  const tier = currentTier(g.tiers, n);
  if (tier) {
    await conn.query(
      `UPDATE buy_groups SET status = 'SUCCESS', closed_at = NOW(), final_members = ?, final_percent = ?,
              claim_until = DATE_ADD(NOW(), INTERVAL ? HOUR) WHERE id = ?`, [n, tier.discount_percent, claimHours(), g.id]);
    g.status = 'SUCCESS';
  } else {
    await conn.query("UPDATE buy_groups SET status = 'FAILED', closed_at = NOW(), final_members = ? WHERE id = ?", [n, g.id]);
    g.status = 'FAILED';
  }
}

// Nhóm còn OPEN nhưng đã quá hạn thì chốt ngay (không đợi tác vụ định kỳ)
async function finalizeIfDue(conn, g) {
  if (g.status === 'OPEN' && g.due) await finalizeGroup(conn, g);
}

// Chốt mọi nhóm quá hạn (tác vụ mỗi phút ở index.js). Trả số nhóm đã chốt.
async function finalizeDueGroups(limit = 100) {
  const [due] = await db.query("SELECT code FROM buy_groups WHERE status = 'OPEN' AND expires_at <= NOW() ORDER BY expires_at LIMIT ?", [limit]);
  let n = 0;
  for (const { code } of due) {
    try {
      await tx(async (conn) => {
        const g = await loadGroup(conn, code, true);
        if (g && g.status === 'OPEN' && g.due) { await finalizeGroup(conn, g); n += 1; }
      });
    } catch (e) {
      console.error(`Không chốt được nhóm ${code}:`, e);
    }
  }
  return n;
}

// Mẫu mã phải thuộc đúng sản phẩm, đang bán và còn hàng
async function assertVariant(exec, productId, variantId) {
  const id = Number(variantId);
  if (!Number.isInteger(id) || id < 1) throw httpError(400, 'Hãy chọn size và màu.');
  const [[v]] = await exec.query(
    `SELECT v.id, v.is_active, COALESCE(i.quantity, 0) AS stock FROM product_variants v
     LEFT JOIN inventories i ON i.variant_id = v.id WHERE v.id = ? AND v.product_id = ?`, [id, productId]);
  if (!v || !v.is_active) throw httpError(400, 'Mẫu mã này không thuộc sản phẩm hoặc đã ngừng bán.');
  if (Number(v.stock) <= 0) throw httpError(400, 'Mẫu mã này đã hết hàng, hãy chọn size hoặc màu khác.');
  return id;
}

async function createGroup(userId, body = {}) {
  const productId = Number(body.product_id);
  if (!Number.isInteger(productId) || productId < 1) throw httpError(400, 'Thiếu sản phẩm');
  const code = await tx(async (conn) => {
    await conn.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]); // xếp hàng các lần tạo nhóm của cùng một người
    const [[p]] = await conn.query("SELECT id FROM products WHERE id = ? AND status = 'ACTIVE'", [productId]);
    if (!p) throw httpError(404, 'Không tìm thấy sản phẩm');
    const cfg = await getGroupConfig(conn, productId);
    if (!cfg.enabled) throw httpError(400, 'Sản phẩm này chưa mở mua nhóm.');
    const variantId = await assertVariant(conn, productId, body.variant_id);

    const [open] = await conn.query(
      "SELECT code, product_id FROM buy_groups WHERE leader_id = ? AND status = 'OPEN' AND expires_at > NOW()", [userId]);
    const same = open.find((g) => g.product_id === productId);
    if (same) throw httpError(409, `Bạn đang có một nhóm mở cho sản phẩm này (mã ${same.code}).`);
    if (open.length >= MAX_OPEN_PER_LEADER) throw httpError(400, `Bạn đang mở tối đa ${MAX_OPEN_PER_LEADER} nhóm, hãy đợi nhóm đóng hoặc hủy bớt.`);

    let groupId;
    let newCode;
    for (let attempt = 1; ; attempt++) {
      newCode = generateCode();
      try {
        const [r] = await conn.query(
          `INSERT INTO buy_groups (code, product_id, leader_id, tiers, expires_at)
           VALUES (?,?,?,?, DATE_ADD(NOW(), INTERVAL ? HOUR))`,
          [newCode, productId, userId, JSON.stringify(cfg.tiers), cfg.hours]);
        groupId = r.insertId;
        break;
      } catch (e) {
        if (e.code !== 'ER_DUP_ENTRY' || attempt >= 5) throw e; // trùng mã (hiếm): thử mã khác
      }
    }
    await conn.query('INSERT INTO buy_group_members (group_id, user_id, variant_id) VALUES (?,?,?)', [groupId, userId, variantId]);
    return newCode;
  });
  return getGroup(code, userId);
}

// Khóa dòng nhóm theo mã; chốt nếu đã quá hạn. Trả null nếu mã sai / không có.
async function lockGroup(conn, rawCode) {
  const code = normalizeCode(rawCode);
  const g = code ? await loadGroup(conn, code, true) : null;
  if (!g) throw httpError(404, 'Không tìm thấy nhóm');
  await finalizeIfDue(conn, g);
  return g;
}

const CLOSED_MESSAGE = {
  SUCCESS: 'Nhóm đã chốt, không nhận thêm người.',
  FAILED: 'Nhóm đã hết hạn mà chưa đủ người.',
  CANCELLED: 'Nhóm đã bị hủy.',
};

async function joinGroup(userId, rawCode, body = {}) {
  const code = await tx(async (conn) => {
    const g = await lockGroup(conn, rawCode);
    if (g.status !== 'OPEN') throw httpError(400, CLOSED_MESSAGE[g.status]);
    const [[already]] = await conn.query('SELECT id FROM buy_group_members WHERE group_id = ? AND user_id = ?', [g.id, userId]);
    if (already) throw httpError(409, 'Bạn đã ở trong nhóm này rồi.');
    const [[p]] = await conn.query("SELECT id FROM products WHERE id = ? AND status = 'ACTIVE'", [g.product_id]);
    if (!p) throw httpError(400, 'Sản phẩm của nhóm này không còn bán.');
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM buy_group_members WHERE group_id = ?', [g.id]);
    // (Nhóm đủ người được chốt ngay ở lần tham gia cuối nên thường không tới đây; giữ để chắc chắn không vượt sức chứa)
    if (n >= capacityOf(g.tiers)) throw httpError(400, 'Nhóm đã đủ người.');
    const variantId = await assertVariant(conn, g.product_id, body.variant_id);
    await conn.query('INSERT INTO buy_group_members (group_id, user_id, variant_id) VALUES (?,?,?)', [g.id, userId, variantId]);
    // Đủ người ở bậc cao nhất thì chốt luôn: không còn bậc nào để leo
    if (n + 1 >= capacityOf(g.tiers)) await finalizeGroup(conn, g);
    return g.code;
  });
  return getGroup(code, userId);
}

async function leaveGroup(userId, rawCode) {
  await tx(async (conn) => {
    const g = await lockGroup(conn, rawCode);
    if (g.status !== 'OPEN') throw httpError(400, CLOSED_MESSAGE[g.status]);
    if (g.leader_id === userId) throw httpError(400, 'Chủ nhóm không rời nhóm được. Hãy hủy nhóm nếu không muốn mua nữa.');
    const [r] = await conn.query('DELETE FROM buy_group_members WHERE group_id = ? AND user_id = ?', [g.id, userId]);
    if (!r.affectedRows) throw httpError(400, 'Bạn không ở trong nhóm này.');
  });
  return { message: 'Đã rời nhóm' };
}

async function cancelGroup(userId, rawCode, { byStaff = false } = {}) {
  await tx(async (conn) => {
    const g = await lockGroup(conn, rawCode);
    if (!byStaff && g.leader_id !== userId) throw httpError(403, 'Chỉ chủ nhóm mới hủy được nhóm.');
    if (g.status !== 'OPEN') {
      throw httpError(400, g.status === 'SUCCESS' ? 'Nhóm đã chốt thành công nên không hủy được (các thành viên đã được hưởng giá nhóm).' : CLOSED_MESSAGE[g.status]);
    }
    await conn.query("UPDATE buy_groups SET status = 'CANCELLED', closed_at = NOW() WHERE id = ?", [g.id]);
  });
  return { message: 'Đã hủy nhóm' };
}

// Đổi size / màu của mình: khi nhóm còn mở, hoặc đã thành công mà mình chưa mua và còn hạn
async function changeVariant(userId, rawCode, body = {}) {
  const code = await tx(async (conn) => {
    const g = await lockGroup(conn, rawCode);
    const [[m]] = await conn.query(
      `SELECT m.id, m.order_id, o.status AS order_status FROM buy_group_members m
       LEFT JOIN orders o ON o.id = m.order_id WHERE m.group_id = ? AND m.user_id = ?`, [g.id, userId]);
    if (!m) throw httpError(400, 'Bạn không ở trong nhóm này.');
    const claimed = m.order_id !== null && m.order_status !== 'CANCELLED';
    const claimable = g.status === 'SUCCESS' && !claimed && Number(g.claim_seconds_left) > 0;
    if (g.status !== 'OPEN' && !claimable) throw httpError(400, claimed ? 'Bạn đã mua theo giá nhóm rồi.' : (CLOSED_MESSAGE[g.status] ?? 'Đã hết hạn mua theo giá nhóm.'));
    const variantId = await assertVariant(conn, g.product_id, body.variant_id);
    await conn.query('UPDATE buy_group_members SET variant_id = ? WHERE id = ?', [variantId, m.id]);
    return g.code;
  });
  return getGroup(code, userId);
}

// ---------------------------------------------------------------------------
// Đọc nhóm
// ---------------------------------------------------------------------------

const claimState = (g, m) => {
  const claimed = m.order_id !== null && m.order_status !== 'CANCELLED';
  if (g.status === 'OPEN') return 'WAIT';
  if (g.status !== 'SUCCESS') return 'NONE';
  if (claimed) return 'CLAIMED';
  return Number(g.claim_seconds_left) > 0 ? 'CAN_CLAIM' : 'EXPIRED';
};

async function describeGroup(g, userId) {
  const [members] = await db.query(
    `SELECT m.user_id, m.variant_id, m.order_id, u.full_name, v.price, s.name AS size_name, c.name AS color_name,
            COALESCE(i.quantity, 0) AS stock, o.status AS order_status
     FROM buy_group_members m
     JOIN users u ON u.id = m.user_id
     JOIN product_variants v ON v.id = m.variant_id
     JOIN sizes s ON s.id = v.size_id JOIN colors c ON c.id = v.color_id
     LEFT JOIN inventories i ON i.variant_id = v.id
     LEFT JOIN orders o ON o.id = m.order_id
     WHERE m.group_id = ? ORDER BY m.id`, [g.id]);
  const [[product]] = await db.query(
    `SELECT p.id, p.name, p.status,
            (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, sort_order, id LIMIT 1) AS thumbnail,
            (SELECT MIN(price) FROM product_variants WHERE product_id = p.id AND is_active = 1) AS price_from
     FROM products p WHERE p.id = ?`, [g.product_id]);

  const tiers = g.tiers;
  const count = members.length;
  const open = g.status === 'OPEN';
  const current = open ? currentTier(tiers, count) : null;
  const next = open ? nextTier(tiers, count) : null;
  const activePercent = open ? (current?.discount_percent ?? null) : (g.status === 'SUCCESS' ? Number(g.final_percent) : null);

  const mine = userId ? members.find((m) => m.user_id === userId) : null;
  const me = mine ? {
    is_leader: mine.user_id === g.leader_id,
    variant: { id: mine.variant_id, size_name: mine.size_name, color_name: mine.color_name, price: mine.price, stock: Number(mine.stock) },
    price_now: activePercent ? groupPrice(mine.price, activePercent) : null,
    discount_now: activePercent ? groupDiscountAmount(mine.price, activePercent) : null,
    claim: claimState(g, mine),
    order_id: mine.order_id !== null && mine.order_status !== 'CANCELLED' ? mine.order_id : null,
  } : null;

  return {
    code: g.code,
    status: g.status,
    share: { code: g.code, url: `${publicUrl()}/g/${g.code}`, deep_link: `hfarm://group/${g.code}` },
    product: { id: product.id, name: product.name, thumbnail: product.thumbnail, price_from: product.price_from, status: product.status },
    tiers,
    member_count: count,
    capacity: capacityOf(tiers),
    current_tier: current,
    next_tier: next,
    members_to_next: next ? next.min_members - count : 0,
    active_percent: activePercent,
    seconds_left: open ? Number(g.seconds_left) : 0,
    claim_seconds_left: g.status === 'SUCCESS' ? Number(g.claim_seconds_left) : null,
    final_members: g.final_members,
    final_percent: g.final_percent === null ? null : Number(g.final_percent),
    members: members.map((m) => ({ name: maskName(m.full_name), is_leader: m.user_id === g.leader_id, is_me: m.user_id === userId })),
    me,
  };
}

async function getGroup(rawCode, userId = null) {
  const code = normalizeCode(rawCode);
  let g = code ? await loadGroup(db, code) : null;
  if (!g) throw httpError(404, 'Không tìm thấy nhóm');
  if (g.status === 'OPEN' && g.due) {
    await tx(async (conn) => { await lockGroup(conn, code); });
    g = await loadGroup(db, code);
  }
  return describeGroup(g, userId);
}

// Các nhóm của tôi (mới nhất trước), kèm tình trạng mua của chính mình
async function listMyGroups(userId) {
  await finalizeDueGroups(100);
  const [rows] = await db.query(
    `${GROUP_SELECT.replace('FROM buy_groups g', `, p.name AS product_name,
       (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, sort_order, id LIMIT 1) AS thumbnail,
       (SELECT COUNT(*) FROM buy_group_members WHERE group_id = g.id) AS member_count,
       m.order_id AS my_order_id, o.status AS my_order_status
     FROM buy_groups g`)}
     JOIN buy_group_members m ON m.group_id = g.id AND m.user_id = ?
     JOIN products p ON p.id = g.product_id
     LEFT JOIN orders o ON o.id = m.order_id
     ORDER BY g.id DESC LIMIT 50`, [userId]);
  return rows.map((g) => ({
    code: g.code,
    status: g.status,
    product_name: g.product_name,
    thumbnail: g.thumbnail,
    member_count: Number(g.member_count),
    capacity: capacityOf(g.tiers),
    current_percent: g.status === 'OPEN' ? (currentTier(g.tiers, Number(g.member_count))?.discount_percent ?? null)
      : g.status === 'SUCCESS' ? Number(g.final_percent) : null,
    is_leader: g.leader_id === userId,
    seconds_left: g.status === 'OPEN' ? Number(g.seconds_left) : 0,
    claim: claimState(g, { order_id: g.my_order_id, order_status: g.my_order_status }),
    claim_seconds_left: g.status === 'SUCCESS' ? Number(g.claim_seconds_left) : null,
  }));
}

// ---------------------------------------------------------------------------
// CMS
// ---------------------------------------------------------------------------

async function adminListGroups({ status, page, limit }) {
  const { page: pageNo, limit: pageSize, offset } = paging({ page, limit });
  const where = [];
  const params = [];
  if (status) {
    if (!['OPEN', 'SUCCESS', 'FAILED', 'CANCELLED'].includes(status)) throw httpError(400, `Trạng thái nhóm không hợp lệ: ${status}`);
    where.push('g.status = ?');
    params.push(status);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM buy_groups g ${w}`, params);
  const [rows] = await db.query(
    `${GROUP_SELECT.replace('FROM buy_groups g', `, p.name AS product_name, u.full_name AS leader_name,
       (SELECT COUNT(*) FROM buy_group_members WHERE group_id = g.id) AS member_count,
       (SELECT COUNT(*) FROM buy_group_members WHERE group_id = g.id AND order_id IS NOT NULL) AS bought_count,
       (SELECT COALESCE(SUM(discount_amount), 0) FROM buy_group_members WHERE group_id = g.id AND order_id IS NOT NULL) AS discount_total
     FROM buy_groups g`)}
     JOIN products p ON p.id = g.product_id JOIN users u ON u.id = g.leader_id
     ${w} ORDER BY g.id DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
  return {
    data: rows.map(({ tiers, due, ...g }) => ({ ...g, capacity: capacityOf(tiers), tiers })),
    page: pageNo, limit: pageSize, total,
  };
}

// ---------------------------------------------------------------------------
// Áp giá nhóm vào đơn (gọi từ services/orders.js: quoteOrder và createOrder dùng CHUNG hàm này)
// ---------------------------------------------------------------------------

const NO_GROUP_DISCOUNT = { discount: 0, claims: [], markUsed: async () => {} };

// detailed: kết quả priceLines [{ v: { id, price, ... }, qty }]. Thành viên của nhóm đã THÀNH CÔNG (còn hạn mua), chưa mua
// (hoặc đơn đã mua bị hủy) được giảm cho đúng mẫu mã đã chọn, mỗi suất 1 sản phẩm: đặt nhiều hơn 1 thì chỉ sản phẩm đầu được giảm.
// forUpdate = true khi đặt hàng thật: khóa các dòng thành viên để hai đơn cùng lúc không cùng giành một suất giảm giá.
async function groupDiscount(exec, { userId, detailed, forUpdate = false }) {
  const variantIds = [...new Set(detailed.map(({ v }) => v.id))];
  if (!variantIds.length) return NO_GROUP_DISCOUNT;
  const [rows] = await exec.query(
    `SELECT m.id, m.variant_id, g.final_percent
     FROM buy_group_members m
     JOIN buy_groups g ON g.id = m.group_id
     LEFT JOIN orders o ON o.id = m.order_id
     WHERE m.user_id = ? AND g.status = 'SUCCESS' AND g.claim_until > NOW()
       AND (m.order_id IS NULL OR o.status = 'CANCELLED')
       AND m.variant_id IN (${variantIds.map(() => '?').join(',')})
     ORDER BY g.final_percent DESC, m.id${forUpdate ? ' FOR UPDATE OF m' : ''}`,
    [userId, ...variantIds]);
  if (!rows.length) return NO_GROUP_DISCOUNT;

  const claims = [];
  let discount = 0;
  for (const { v, qty } of detailed) {
    const slots = rows.filter((r) => r.variant_id === v.id).slice(0, qty);
    for (const s of slots) {
      const amount = groupDiscountAmount(v.price, s.final_percent);
      claims.push({ memberId: s.id, amount });
      discount += amount;
    }
  }
  if (!claims.length) return NO_GROUP_DISCOUNT;
  return {
    discount,
    claims,
    // Ghi đơn vào các suất đã dùng (gọi trong cùng transaction với việc tạo đơn)
    async markUsed(conn, orderId) {
      for (const c of claims) await conn.query('UPDATE buy_group_members SET order_id = ?, discount_amount = ? WHERE id = ?', [orderId, c.amount, c.memberId]);
    },
  };
}

module.exports = {
  CODE_ALPHABET, CODE_LENGTH, MAX_TIERS, DEFAULT_HOURS,
  generateCode, normalizeCode, validateTiers, currentTier, nextTier, capacityOf, groupPrice, groupDiscountAmount,
  getGroupConfig, saveGroupConfig, createGroup, joinGroup, leaveGroup, cancelGroup, changeVariant, getGroup, listMyGroups,
  finalizeDueGroups, adminListGroups, groupDiscount,
};
