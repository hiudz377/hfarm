// Stylist: chọn bộ đồ hoàn chỉnh (áo + quần + giày + phụ kiện...) từ SẢN PHẨM THẬT của cửa hàng cho đúng phong cách,
// hoàn cảnh, size theo số đo và NGÂN SÁCH. Cửa hàng CHỈ bán đồ nam nên không có lựa chọn giới tính, váy hay đầm.
//
// Đây là bộ máy chấm điểm + tìm tổ hợp (không phải mô hình ngôn ngữ): chạy ngay trên server, không gọi dịch vụ ngoài, không gửi
// chiều cao/cân nặng của khách đi đâu, và luôn đảm bảo bộ đồ trả về chỉ gồm sản phẩm đang bán, còn hàng, có size phù hợp và
// tổng tiền KHÔNG vượt ngân sách. Lời giải thích (reasons, highlights) soạn theo mẫu từ chính dữ liệu thẻ của sản phẩm.
//
// File này không đụng database (dữ liệu vào là tham số) để chạy thử độc lập: backend/test/stylist.test.js.
const { httpError } = require('../utils');
const { letterRank, sizeGroup } = require('./sizes');

// ---- Danh sách mã hợp lệ (dùng chung cho CMS gắn thẻ, app và kiểm tra dữ liệu). Thêm mã mới chỉ cần sửa ở đây. ----
// Lưu ý: cột products.gender và giá trị outfit_role = 'DRESS' vẫn còn trong database (migration 003 đã chạy, migration chỉ được thêm)
// nhưng KHÔNG còn được dùng: cửa hàng chỉ bán đồ nam.
const ROLES = { TOP: 'Áo', BOTTOM: 'Quần', OUTERWEAR: 'Áo khoác', SHOES: 'Giày', ACCESSORY: 'Phụ kiện' };
const STYLES = {
  MINIMALIST: 'Minimalist', CASUAL: 'Casual', STREETWEAR: 'Streetwear', SPORTY: 'Sporty',
  ELEGANT: 'Thanh lịch', VINTAGE: 'Vintage', KOREAN: 'Hàn Quốc', LUXURY: 'Luxury', JAPANESE: 'Nhật Bản',
};
// Phong cách ưa màu trung tính (đen, trắng, xám, be, navy, nâu): chọn mẫu mã màu trung tính trước. Luxury và Nhật Bản cũng thuộc nhóm này.
const CALM_STYLES = ['MINIMALIST', 'ELEGANT', 'LUXURY', 'JAPANESE'];
// Phong cách mà màu trung tính còn được CỘNG ĐIỂM và ghi vào lý do (ELEGANT giữ nguyên như trước: chỉ ưu tiên chọn màu)
const NEUTRAL_BONUS_STYLES = ['MINIMALIST', 'LUXURY', 'JAPANESE'];
const OCCASIONS = {
  SCHOOL: 'Đi học', WORK: 'Đi làm', HANGOUT: 'Đi chơi', DATE: 'Hẹn hò', PARTY: 'Dự tiệc', SPORT: 'Tập thể thao', TRAVEL: 'Du lịch',
};
// Thứ tự hiện các món trong một bộ đồ (từ trên xuống dưới)
const ROLE_ORDER = ['OUTERWEAR', 'TOP', 'BOTTOM', 'SHOES', 'ACCESSORY'];

const BUDGET_MIN = 100000;
const BUDGET_MAX = 100000000;
const MAX_STYLES = 3;
const MAX_OUTFITS = 3;

const entries = (obj) => Object.entries(obj).map(([value, label]) => ({ value, label }));
const stylistOptions = () => ({
  roles: entries(ROLES),
  styles: entries(STYLES),
  occasions: entries(OCCASIONS),
  budget: { min: BUDGET_MIN, max: BUDGET_MAX },
  max_styles: MAX_STYLES,
});

// ---- Thẻ của sản phẩm (CMS gắn) ----
const splitTags = (value) => String(value ?? '').split(',').map((s) => s.trim()).filter(Boolean);

// Nhận mảng hoặc chuỗi "A,B"; trả mảng không trùng; mã lạ -> 400
function cleanTagList(input, allowed, label) {
  const list = Array.isArray(input) ? input : splitTags(input);
  const out = [...new Set(list.map((v) => String(v).trim()).filter(Boolean))];
  const bad = out.find((v) => !Object.hasOwn(allowed, v));
  if (bad) throw httpError(400, `${label} không hợp lệ: ${bad}`);
  return out;
}

// Lấy các cột thẻ từ body của POST/PUT /admin/products. Chỉ trả các khóa có trong body (PUT sửa từng phần).
function cleanProductTags(body) {
  const out = {};
  if (body.outfit_role !== undefined) {
    const role = body.outfit_role || null;
    if (role !== null && !Object.hasOwn(ROLES, role)) throw httpError(400, 'Vai trò trong bộ đồ không hợp lệ');
    out.outfit_role = role;
  }
  if (body.styles !== undefined) out.styles = cleanTagList(body.styles, STYLES, 'Phong cách').join(',');
  if (body.occasions !== undefined) out.occasions = cleanTagList(body.occasions, OCCASIONS, 'Hoàn cảnh').join(',');
  return out;
}

// ---- Dữ liệu khách nhập ----
const toNumber = (v) => Number(String(v ?? '').trim().replace(',', '.'));

function parseProfile(body = {}) {
  const height = toNumber(body.height_cm);
  if (!Number.isFinite(height) || height < 120 || height > 220) throw httpError(400, 'Chiều cao nên từ 120 đến 220 cm.');
  const weight = toNumber(body.weight_kg);
  if (!Number.isFinite(weight) || weight < 25 || weight > 150) throw httpError(400, 'Cân nặng nên từ 25 đến 150 kg.');
  const rawStyles = Array.isArray(body.styles) ? body.styles : (body.style ? [body.style] : []);
  const styles = cleanTagList(rawStyles, STYLES, 'Phong cách');
  if (!styles.length || styles.length > MAX_STYLES) throw httpError(400, `Hãy chọn từ 1 đến ${MAX_STYLES} phong cách.`);
  const occasion = String(body.occasion ?? '');
  if (!Object.hasOwn(OCCASIONS, occasion)) throw httpError(400, 'Hãy chọn hoàn cảnh.');
  const budget = toNumber(body.budget);
  if (!Number.isFinite(budget) || budget < BUDGET_MIN || budget > BUDGET_MAX) {
    throw httpError(400, 'Ngân sách nên từ 100.000 đến 100.000.000 ₫.');
  }
  return { height_cm: height, weight_kg: weight, styles, occasion, budget: Math.round(budget) };
}

// ---- Size theo số đo ----
// GIỮ KHỚP với mobile/src/content/sizeGuide.js (bảng tham khảo chung, màn "Hướng dẫn chọn size"): sửa bảng thì sửa cả hai nơi.
// Mỗi dòng: [chiều cao tối đa, cân nặng tối đa, [eo nhỏ nhất, eo lớn nhất] (cm)]
const LETTER_SIZES = [
  { size: 'XS', height: 157, weight: 47, waist: [62, 66] },
  { size: 'S', height: 162, weight: 52, waist: [66, 70] },
  { size: 'M', height: 167, weight: 58, waist: [70, 74] },
  { size: 'L', height: 172, weight: 64, waist: [74, 80] },
  { size: 'XL', height: 177, weight: 72, waist: [80, 86] },
  { size: 'XXL', height: 182, weight: 80, waist: [86, 92] },
];
// Chiều dài bàn chân nam xấp xỉ 15,2% chiều cao; size giày EU = (dài chân + 1,5 cm) x 1,5.
// Đây chỉ là ƯỚC LƯỢNG THÔ theo chiều cao, app luôn nhắc khách kiểm tra lại size giày.
const FOOT_RATIO = 0.152;

function adviseSize(heightCm, weightKg) {
  // Lấy size lớn hơn trong hai kết quả (theo cân nặng, theo chiều cao), giống màn Hướng dẫn chọn size
  const byWeight = LETTER_SIZES.findIndex((s) => weightKg <= s.weight);
  const byHeight = LETTER_SIZES.findIndex((s) => heightCm <= s.height);
  const tooBig = byWeight === -1 || byHeight === -1;
  const row = LETTER_SIZES[tooBig ? LETTER_SIZES.length - 1 : Math.max(byWeight, byHeight)];
  const waistCm = (row.waist[0] + row.waist[1]) / 2;
  return {
    letter: row.size,
    letter_rank: letterRank(row.size),
    waist_inch: Math.round((waistCm / 2.54) * 10) / 10,
    shoe: Math.round((heightCm * FOOT_RATIO + 1.5) * 1.5),
    too_big: tooBig,
  };
}

// Mức độ hợp của một size với số đo: { cost, note } (cost nhỏ = hợp hơn; note 'EXACT' | 'NEAR' | null) hoặc null nếu lệch quá.
function sizeFit(role, sizeName, advice) {
  if (role === 'ACCESSORY') return { cost: 0, note: null };
  const group = sizeGroup(sizeName);
  if (group === 'OTHER') return { cost: 0.2, note: null }; // Free size
  const num = parseFloat(String(sizeName).replace(',', '.'));
  if (role === 'SHOES' && group === 'NUMBER') {
    const d = Math.abs(num - advice.shoe);
    return d <= 1 ? { cost: d, note: d === 0 ? 'EXACT' : 'NEAR' } : null;
  }
  if (role !== 'SHOES' && group === 'LETTER') {
    const d = letterRank(sizeName) - advice.letter_rank;
    if (d === 0) return { cost: 0, note: 'EXACT' };
    if (d === 1) return { cost: 1, note: 'NEAR' }; // lớn hơn 1 size an toàn hơn nhỏ hơn
    if (d === -1) return { cost: 1.5, note: 'NEAR' };
    return null;
  }
  if (role === 'BOTTOM' && group === 'NUMBER') {
    const d = Math.abs(num - advice.waist_inch);
    return d <= 1.6 ? { cost: d, note: d < 0.5 ? 'EXACT' : 'NEAR' } : null;
  }
  return { cost: 1, note: null }; // kiểu size không khớp vai trò (ví dụ áo theo size số): không đánh giá được
}

// ---- Màu ----
const NEUTRAL_WORDS = new Set(['den', 'trang', 'xam', 'ghi', 'be', 'kem', 'navy', 'nau', 'bac', 'khaki', 'denim', 'jean', 'tan']);
const plain = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();

function hslOf(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

// neutral: màu trung tính dễ phối (đen, trắng, xám, be, navy, nâu, denim...). Tên màu (tiếng Việt) quyết định trước, mã hex là dự phòng.
function colorInfo(name, hex) {
  const words = plain(name).split(/[^a-z]+/).filter(Boolean);
  const hsl = hslOf(hex);
  const neutral = words.some((w) => NEUTRAL_WORDS.has(w)) || (hsl ? hsl.s < 0.18 || hsl.l < 0.12 || hsl.l > 0.9 : false);
  return { neutral, hue: hsl ? hsl.h : null };
}

const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

// Điểm hài hòa màu của cả bộ: toàn màu trung tính hoặc chỉ một màu nổi bật thì dễ phối; nhiều màu nổi bật khác tông thì rối.
function harmony(colors) {
  const loud = colors.filter((c) => !c.neutral);
  if (loud.length <= 1) return 2;
  const similar = loud.every((c) => c.hue !== null && loud[0].hue !== null && hueGap(c.hue, loud[0].hue) <= 30);
  return similar ? 1 : -(loud.length - 1);
}

// ---- Chấm điểm từng sản phẩm ----

// So sánh hai khóa số theo thứ tự từ điển: a < b
function lexLess(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

// Chọn mẫu mã (size x màu) tốt nhất của một sản phẩm cho khách: đúng size nhất -> màu hợp phong cách -> rẻ hơn -> còn nhiều hơn
function bestVariant(role, variants, advice, profile) {
  const calm = profile.styles.some((s) => CALM_STYLES.includes(s));
  let best = null;
  for (const v of variants) {
    if (!(Number(v.stock) > 0)) continue;
    const fit = sizeFit(role, v.size_name, advice);
    if (!fit) continue;
    const color = colorInfo(v.color_name, v.hex_code);
    const key = [fit.cost + (calm && !color.neutral ? 0.5 : 0), Number(v.price), -Number(v.stock), Number(v.id)];
    if (!best || lexLess(key, best.key)) best = { variant: v, fit, color, key };
  }
  return best;
}

// Trả null nếu sản phẩm không hợp (không có size phù hợp, hoặc rõ ràng sai cả hoàn cảnh lẫn phong cách)
function candidateOf(product, variants, advice, profile) {
  const role = product.outfit_role;
  const picked = bestVariant(role, variants, advice, profile);
  if (!picked) return null;
  const occasions = splitTags(product.occasions);
  const styles = splitTags(product.styles);
  const occMatch = occasions.includes(profile.occasion);
  const styleMatches = profile.styles.filter((s) => styles.includes(s));
  if (occasions.length && !occMatch && styles.length && !styleMatches.length) return null;

  const v = picked.variant;
  let score = 0;
  const reasons = [];
  if (occasions.length) score += occMatch ? 4 : -4;
  if (occMatch) reasons.push(`Hợp hoàn cảnh ${OCCASIONS[profile.occasion].toLowerCase()}`);
  if (styles.length) score += styleMatches.length ? 3 + Math.min(styleMatches.length - 1, 2) : -3;
  if (styleMatches.length) reasons.push(`Đúng phong cách ${styleMatches.slice(0, 2).map((s) => STYLES[s]).join(' & ')}`);
  if (picked.color.neutral && profile.styles.some((s) => NEUTRAL_BONUS_STYLES.includes(s))) { score += 1; reasons.push('Màu trung tính, dễ phối'); }
  if (picked.fit.note === 'EXACT') {
    score += 0.5;
    reasons.push(role === 'SHOES' ? `Size ${v.size_name} (ước lượng theo chiều cao)` : `Size ${v.size_name} hợp số đo của bạn`);
  } else if (picked.fit.note === 'NEAR') {
    reasons.push(`Size ${v.size_name} là size gần nhất còn hàng`);
  }
  const rated = Number(product.rating_count) > 0;
  if (rated) score += Math.max(-1, Math.min(1, (Number(product.rating_avg) - 3) * 0.5));
  if (rated && Number(product.rating_avg) >= 4) reasons.push(`${Number(product.rating_avg).toFixed(1)} sao từ ${product.rating_count} đánh giá`);
  score += Math.min(Number(product.sold_count) || 0, 20) / 20;
  const onSale = Number(v.compare_at_price) > Number(v.price);
  if (onSale) { score += 0.5; reasons.push('Đang giảm giá'); }

  return {
    role, product, variant: v, price: Number(v.price), score, reasons: reasons.slice(0, 4),
    color: picked.color, sizeNote: picked.fit.note, occMatch, styleMatch: styleMatches.length > 0,
  };
}

const itemOf = (c) => ({
  role: c.role,
  role_label: ROLES[c.role],
  product_id: c.product.id,
  name: c.product.name,
  brand_name: c.product.brand_name ?? null,
  thumbnail: c.product.thumbnail ?? null,
  variant_id: c.variant.id,
  size_name: c.variant.size_name,
  color_name: c.variant.color_name,
  hex_code: c.variant.hex_code ?? null,
  price: c.price,
  compare_at_price: Number(c.variant.compare_at_price) > c.price ? Number(c.variant.compare_at_price) : null,
  stock: Number(c.variant.stock),
  size_note: c.sizeNote,
  reasons: c.reasons,
});

// ---- Tìm tổ hợp ----
// Mẫu bộ đồ: phần lõi bắt buộc + các món thêm (có thì tốt, chỉ thêm khi còn trong ngân sách).
// Điểm cộng khi có món thêm đặt LỚN hơn khoảng chênh điểm phong cách giữa các sản phẩm (mỗi món khoảng -7..+9): một bộ đủ
// giày, phụ kiện luôn được ưu tiên hơn bộ thiếu nếu ngân sách cho phép, vì khách cần "một bộ hoàn chỉnh".
const CORE = ['TOP', 'BOTTOM'];
const EXTRAS = ['SHOES', 'ACCESSORY', 'OUTERWEAR'];
const EXTRA_BONUS = { SHOES: 12, ACCESSORY: 4, OUTERWEAR: 3 };
// Mỗi vai trò chỉ giữ các ứng viên tốt nhất (theo điểm) cộng vài món rẻ nhất (để ngân sách thấp vẫn ghép được)
const KEEP_BEST = 6;
const KEEP_CHEAPEST = 2;

function shortlist(list) {
  const byScore = [...list].sort((a, b) => b.score - a.score || a.price - b.price || a.product.id - b.product.id);
  const cheapest = [...list].sort((a, b) => a.price - b.price || b.score - a.score).slice(0, KEEP_CHEAPEST);
  return [...new Set([...byScore.slice(0, KEEP_BEST), ...cheapest])];
}

function rankCombo(items, total, budget) {
  const bonus = items.reduce((s, c) => s + (EXTRA_BONUS[c.role] ?? 0), 0);
  const h = harmony(items.map((c) => c.color));
  const score = items.reduce((s, c) => s + c.score, 0) + bonus + h + 3 * (total / budget);
  return { score, harmony: h };
}

function enumerate(byRole, budget) {
  const coreLists = CORE.map((r) => shortlist(byRole[r] ?? []));
  if (coreLists.some((l) => !l.length)) return [];
  const extraLists = EXTRAS.map((r) => shortlist(byRole[r] ?? []));
  const out = [];
  const pickExtra = (j, acc, total) => {
    if (j === extraLists.length) {
      out.push({ items: acc, total, core: acc.slice(0, CORE.length), ...rankCombo(acc, total, budget) });
      return;
    }
    pickExtra(j + 1, acc, total);
    for (const c of extraLists[j]) if (total + c.price <= budget) pickExtra(j + 1, [...acc, c], total + c.price);
  };
  const pickCore = (i, acc, total) => {
    if (total > budget) return;
    if (i === coreLists.length) { pickExtra(0, acc, total); return; }
    for (const c of coreLists[i]) pickCore(i + 1, [...acc, c], total + c.price);
  };
  pickCore(0, [], 0);
  return out;
}

const minPrice = (list) => (list.length ? Math.min(...list.map((c) => c.price)) : null);

// Vì sao chưa ghép được bộ nào: thiếu sản phẩm thuộc vai trò cần thiết, hay ngân sách quá thấp
function explainEmpty(byRole) {
  const missing = CORE.filter((r) => !(byRole[r] ?? []).length);
  if (missing.length) return { empty_reason: 'NO_PRODUCT', missing_roles: missing.map((r) => ({ role: r, role_label: ROLES[r] })) };
  return { empty_reason: 'BUDGET_TOO_LOW', min_budget: CORE.reduce((sum, r) => sum + minPrice(byRole[r]), 0) };
}

// Điều kiện: products (mỗi dòng có id, name, outfit_role, styles, occasions, thumbnail, brand_name, rating_avg,
// rating_count, sold_count), variants (id, product_id, size_name, color_name, hex_code, price, compare_at_price, stock).
function buildOutfits(profile, products, variants) {
  const advice = adviseSize(profile.height_cm, profile.weight_kg);
  const variantsOf = new Map();
  for (const v of variants) {
    if (!variantsOf.has(v.product_id)) variantsOf.set(v.product_id, []);
    variantsOf.get(v.product_id).push(v);
  }

  const byRole = {};
  for (const p of products) {
    if (!Object.hasOwn(ROLES, p.outfit_role)) continue;
    const c = candidateOf(p, variantsOf.get(p.id) ?? [], advice, profile);
    if (c) (byRole[c.role] ??= []).push(c);
  }

  const combos = enumerate(byRole, profile.budget);
  combos.sort((a, b) => b.score - a.score || a.total - b.total);

  // Chọn tối đa 3 bộ KHÁC NHAU về phần lõi (áo + quần): không đưa ra 3 bộ chỉ khác mỗi đôi giày
  const chosen = [];
  const seenCores = new Set();
  for (const combo of combos) {
    const key = combo.core.map((c) => c.product.id).join('-');
    if (seenCores.has(key)) continue;
    seenCores.add(key);
    chosen.push(combo);
    if (chosen.length === MAX_OUTFITS) break;
  }

  const styleText = profile.styles.map((s) => STYLES[s]).join(' / ');
  // Nhãn: bộ đầu = hợp nhất; trong các bộ còn lại, chỉ MỘT bộ rẻ nhất (rẻ hơn bộ đầu trên 10%) được gọi là "Tiết kiệm hơn"
  const saver = chosen.reduce((pick, c, i) => (
    i > 0 && c.total < chosen[0].total * 0.9 && (pick === -1 || c.total < chosen[pick].total) ? i : pick), -1);
  const outfits = chosen.map((combo, index) => {
    const items = [...combo.items].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
    const have = new Set(items.map((c) => c.role));
    const skipped = [];
    for (const role of ['SHOES', 'ACCESSORY']) {
      if (have.has(role)) continue;
      const cheapest = minPrice(byRole[role] ?? []);
      if (cheapest === null) { if (role === 'SHOES') skipped.push({ role, role_label: ROLES[role], reason: 'NO_PRODUCT' }); }
      else skipped.push({ role, role_label: ROLES[role], reason: 'OVER_BUDGET', need_budget: combo.total + cheapest });
    }
    const n = items.length;
    const styleCount = items.filter((c) => c.styleMatch).length;
    const occCount = items.filter((c) => c.occMatch).length;
    const highlights = [];
    if (styleCount === n) highlights.push(`Cả bộ đúng phong cách ${styleText}`);
    else if (styleCount > 0) highlights.push(`${styleCount}/${n} món đúng phong cách ${styleText}`);
    if (occCount === n) highlights.push(`Cả bộ hợp hoàn cảnh ${OCCASIONS[profile.occasion].toLowerCase()}`);
    else if (occCount > 0) highlights.push(`${occCount}/${n} món hợp hoàn cảnh ${OCCASIONS[profile.occasion].toLowerCase()}`);
    if (combo.harmony >= 2) highlights.push('Màu sắc dễ phối với nhau');
    if (items.every((c) => c.sizeNote === 'EXACT' || c.role === 'ACCESSORY')) highlights.push('Đủ size theo số đo của bạn');

    const label = index === 0 ? ['BEST', 'Phù hợp nhất'] : index === saver ? ['SAVER', 'Tiết kiệm hơn'] : ['ALT', 'Phối khác'];
    return {
      key: label[0], label: label[1], total: combo.total, remaining: profile.budget - combo.total,
      items: items.map(itemOf), highlights, skipped,
    };
  });

  const notes = [];
  if (advice.too_big) notes.push('Số đo của bạn vượt bảng size tham khảo, hãy xem kỹ số đo từng món hoặc liên hệ cửa hàng để được tư vấn.');
  return {
    profile,
    size_advice: { letter: advice.letter, shoe: advice.shoe, shoe_estimated: true, too_big: advice.too_big },
    outfits,
    notes,
    ...(outfits.length ? {} : explainEmpty(byRole)),
  };
}

module.exports = {
  ROLES, STYLES, OCCASIONS, ROLE_ORDER, LETTER_SIZES, CALM_STYLES, NEUTRAL_BONUS_STYLES,
  BUDGET_MIN, BUDGET_MAX, MAX_STYLES,
  stylistOptions, splitTags, cleanProductTags, parseProfile, adviseSize, buildOutfits,
  // Dùng chung với Quà tặng (services/gifts.js): chọn mẫu mã đúng size, nhận biết màu, hài hòa màu, dạng JSON của một món
  sizeFit, colorInfo, bestVariant, harmony, itemOf,
};
