// Quà tặng: người thân (vợ, bạn gái, mẹ...) chọn quà cho một bạn nam theo DỊP + SIZE của bạn ấy + NGÂN SÁCH,
// chọn thiệp, viết lời nhắn. Cửa hàng CHỈ bán đồ nam nên không có lựa chọn giới tính.
//
// Dùng chung bộ máy size/màu của Stylist (services/stylist.js) nhưng KHÁC cách trả lời: Stylist ghép cả bộ đồ để người mua tự mặc,
// còn Quà tặng trả về "quà chính" (món lẻ), "combo quà" (2-3 món) và "quà nhỏ kèm theo", và THẬN TRỌNG HƠN vì quà dễ sai size:
//   - giày chỉ được gợi ý khi biết CHẮC size giày và có đúng size đó (không ước lượng theo chiều cao);
//   - chưa biết gu thì ưu tiên màu trung tính (khó sai) và món được nhiều người mua / đánh giá tốt.
//
// File này không đụng database (dữ liệu vào là tham số) để chạy thử độc lập: backend/test/gifts.test.js.
// Phần ghi đơn quà nằm ở services/giftOrders.js.
const { httpError } = require('../utils');
const { letterRank } = require('./sizes');
const {
  ROLES, STYLES, OCCASIONS: WEAR, ROLE_ORDER, LETTER_SIZES, CALM_STYLES, NEUTRAL_BONUS_STYLES, BUDGET_MIN, BUDGET_MAX, MAX_STYLES,
  splitTags, adviseSize, bestVariant, harmony, itemOf,
} = require('./stylist');

// ---- Dịp tặng quà ----
// wear: dịp mặc tương ứng trong Stylist (chỉ dùng để cộng điểm cho sản phẩm ĐÃ gắn thẻ hoàn cảnh; sản phẩm chưa gắn thẻ thì trung tính).
// month/day: ngày dương lịch cố định để đếm ngược. Sinh nhật / kỷ niệm là ngày riêng, Tết theo âm lịch: không có đếm ngược.
const OCCASIONS = {
  BIRTHDAY: { label: 'Sinh nhật', wear: 'HANGOUT', budget: 700000 },
  ANNIVERSARY: { label: 'Kỷ niệm', wear: 'DATE', budget: 1000000 },
  VALENTINE: { label: 'Valentine', month: 2, day: 14, wear: 'DATE', budget: 1000000 },
  WHITE_DAY: { label: 'White Day', month: 3, day: 14, wear: 'DATE', budget: 800000 },
  MEN_DAY: { label: 'Quốc tế Nam giới', month: 11, day: 19, wear: 'WORK', budget: 500000 },
  CHRISTMAS: { label: 'Giáng sinh', month: 12, day: 24, wear: 'PARTY', budget: 700000 },
  TET: { label: 'Tết', wear: 'PARTY', budget: 1000000 },
  SURPRISE: { label: 'Bất ngờ nhỏ', wear: 'HANGOUT', budget: 300000 },
};

// ---- Mẫu thiệp ----
// Một nguồn duy nhất: app vẽ để xem trước, CMS vẽ lại để in. occasions rỗng = hợp mọi dịp.
// font: 'serif' | 'sans'. border: 'double' | 'solid' | 'dashed' | 'none'. ornament: ký tự trang trí (Unicode, không cần ảnh).
const CARDS = [
  { id: 'cream-classic', name: 'Kem cổ điển', occasions: [], bg: '#FBF5E9', ink: '#4A3B2A', accent: '#B08D57', border: 'double', ornament: '✦', font: 'serif' },
  { id: 'rose-romance', name: 'Hồng lãng mạn', occasions: ['VALENTINE', 'WHITE_DAY', 'ANNIVERSARY'], bg: '#FDEDEF', ink: '#6B1F33', accent: '#C2455F', border: 'solid', ornament: '♥', font: 'serif' },
  { id: 'midnight-gold', name: 'Đêm vàng', occasions: ['BIRTHDAY', 'ANNIVERSARY', 'MEN_DAY'], bg: '#14213D', ink: '#F5E9C8', accent: '#E0B84C', border: 'solid', ornament: '★', font: 'serif' },
  { id: 'noel-forest', name: 'Noel rừng thông', occasions: ['CHRISTMAS'], bg: '#12372A', ink: '#F4EFE0', accent: '#E4B9B0', border: 'double', ornament: '❄', font: 'serif' },
  { id: 'spring-red', name: 'Xuân đỏ', occasions: ['TET'], bg: '#B3202A', ink: '#FFF3D6', accent: '#F2C14E', border: 'double', ornament: '✿', font: 'serif' },
  { id: 'sky-fun', name: 'Trời xanh vui', occasions: ['BIRTHDAY', 'SURPRISE', 'MEN_DAY'], bg: '#E8F4FD', ink: '#1B4965', accent: '#3A86C8', border: 'solid', ornament: '✦', font: 'sans' },
  { id: 'kraft-simple', name: 'Giấy kraft', occasions: ['SURPRISE', 'MEN_DAY', 'BIRTHDAY', 'TET'], bg: '#E7D3B5', ink: '#3E2C1C', accent: '#8B5E34', border: 'dashed', ornament: '✿', font: 'sans' },
  { id: 'mono-minimal', name: 'Tối giản', occasions: [], bg: '#FFFFFF', ink: '#111111', accent: '#111111', border: 'solid', ornament: '—', font: 'sans' },
];

// ---- Lời chúc gợi ý (bấm là điền vào ô lời nhắn, người dùng vẫn sửa được) ----
const WISHES = {
  BIRTHDAY: [
    'Chúc mừng sinh nhật anh! Mong anh luôn khỏe, luôn vui và luôn là chỗ dựa của em.',
    'Sinh nhật vui vẻ nhé! Thêm một tuổi mới, thêm thật nhiều niềm vui và may mắn.',
    'Chúc mừng sinh nhật! Mong mọi điều bạn mong muốn năm nay đều thành sự thật.',
    'Tuổi mới tới rồi, mặc đồ mới cho thật phong độ nhé! Sinh nhật vui vẻ!',
  ],
  ANNIVERSARY: [
    'Cảm ơn anh đã ở bên em suốt thời gian qua. Chúc mừng kỷ niệm của chúng mình!',
    'Thêm một năm bên nhau, thêm thật nhiều kỷ niệm đẹp. Em yêu anh!',
    'Mỗi ngày bên anh đều là một ngày đáng nhớ. Kỷ niệm vui nhé!',
    'Món quà nhỏ cho một chặng đường dài. Cảm ơn vì tất cả!',
  ],
  VALENTINE: [
    'Valentine này em chỉ muốn nói: em yêu anh nhiều lắm!',
    'Gửi anh món quà nhỏ cùng thật nhiều yêu thương nhân ngày Valentine.',
    'Có anh, ngày nào cũng là Valentine. Yêu anh!',
    'Mong anh mặc món quà này thật đẹp để đi chơi cùng em nhé!',
  ],
  WHITE_DAY: [
    'White Day ngọt ngào! Gửi anh món quà nhỏ để đáp lại những yêu thương của anh.',
    'Cảm ơn anh vì đã luôn quan tâm em. Chúc anh một ngày thật vui!',
    'Món quà nhỏ nhân ngày White Day, mong anh thích!',
    'Ngày 14/3 này, đến lượt em chiều anh nhé!',
  ],
  MEN_DAY: [
    'Chúc mừng Ngày Quốc tế Nam giới! Cảm ơn anh đã luôn vất vả vì gia đình nhỏ của mình.',
    'Hôm nay là ngày của anh: nghỉ ngơi, thư giãn và mặc thật đẹp nhé!',
    'Gửi người đàn ông tuyệt vời món quà nhỏ nhân ngày của riêng anh.',
    'Cảm ơn vì luôn mạnh mẽ và dịu dàng. Chúc anh một ngày thật vui!',
  ],
  CHRISTMAS: [
    'Giáng sinh an lành! Mong mùa đông này của anh luôn ấm áp.',
    'Gửi anh món quà nhỏ dưới cây thông Noel. Merry Christmas!',
    'Noel này có anh bên cạnh là món quà đẹp nhất của em.',
    'Chúc bạn một mùa Giáng sinh thật vui và thật ấm!',
  ],
  TET: [
    'Chúc anh năm mới an khang, thịnh vượng, vạn sự như ý!',
    'Năm mới mặc đồ mới, mang theo thật nhiều may mắn và niềm vui!',
    'Xuân đến rồi, chúc bạn sức khỏe dồi dào và thành công trong năm mới.',
    'Gửi anh chút quà xuân, mong một năm thật nhiều bình an.',
  ],
  SURPRISE: [
    'Không phải dịp gì đặc biệt cả, chỉ là em muốn tặng anh thôi!',
    'Một chút bất ngờ nhỏ để bạn mỉm cười hôm nay.',
    'Thấy món này là nghĩ ngay đến anh. Hy vọng anh thích!',
    'Gửi anh món quà nhỏ cùng lời cảm ơn vì đã luôn ở bên em.',
  ],
};

const MESSAGE_MAX = 300;
const SENDER_MAX = 60;
const BUDGET_PRESETS = [300000, 500000, 700000, 1000000, 1500000];
const SIZE_LETTERS = LETTER_SIZES.map((s) => s.size);
const SHOE_EU = { min: 36, max: 47 };

const cardOf = (id) => CARDS.find((c) => c.id === id) ?? null;

// ---- Đếm ngược tới dịp ----
// "Hôm nay" theo giờ Việt Nam (máy chủ có thể chạy múi giờ UTC trong Docker). Trả số ngày tới lần tới của (tháng, ngày), 0 = hôm nay.
function vnToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

function daysUntil(month, day, now = new Date()) {
  const t = vnToday(now);
  const today = Date.UTC(t.y, t.m - 1, t.d);
  let target = Date.UTC(t.y, month - 1, day);
  if (target < today) target = Date.UTC(t.y + 1, month - 1, day);
  return Math.round((target - today) / 86400000);
}

const entries = (obj) => Object.entries(obj).map(([value, label]) => ({ value, label }));

// Dùng cho GET /api/gifts/options (app và CMS lấy chung một danh sách)
function giftOptions(now = new Date()) {
  return {
    occasions: Object.entries(OCCASIONS).map(([value, o]) => ({
      value,
      label: o.label,
      date_text: o.month ? `${o.day}/${o.month}` : null,
      days_left: o.month ? daysUntil(o.month, o.day, now) : null,
      budget_default: o.budget,
    })),
    cards: CARDS,
    wishes: WISHES,
    styles: entries(STYLES),
    max_styles: MAX_STYLES,
    budget: { min: BUDGET_MIN, max: BUDGET_MAX, presets: BUDGET_PRESETS },
    sizes: { letters: SIZE_LETTERS, shoe_eu: SHOE_EU },
    message_max: MESSAGE_MAX,
    sender_max: SENDER_MAX,
  };
}

// ---- Dữ liệu người mua nhập để xin gợi ý ----
const toNumber = (v) => Number(String(v ?? '').trim().replace(',', '.'));

// body: { occasion, budget, styles?: [0-3 mã], fit: { mode: 'MEASURE', height_cm, weight_kg, shoe? } | { mode: 'SIZE', top, bottom?, shoe? } }
function parseGiftRequest(body = {}) {
  const occasion = String(body.occasion ?? '');
  if (!Object.hasOwn(OCCASIONS, occasion)) throw httpError(400, 'Hãy chọn dịp tặng quà.');
  const budget = toNumber(body.budget);
  if (!Number.isFinite(budget) || budget < BUDGET_MIN || budget > BUDGET_MAX) {
    throw httpError(400, 'Ngân sách nên từ 100.000 đến 100.000.000 ₫.');
  }
  const rawStyles = Array.isArray(body.styles) ? body.styles : [];
  const styles = [...new Set(rawStyles.map((s) => String(s).trim()).filter(Boolean))];
  const badStyle = styles.find((s) => !Object.hasOwn(STYLES, s));
  if (badStyle) throw httpError(400, `Phong cách không hợp lệ: ${badStyle}`);
  if (styles.length > MAX_STYLES) throw httpError(400, `Chọn tối đa ${MAX_STYLES} phong cách.`);

  const f = body.fit ?? {};
  let shoe = null;
  if (f.shoe !== undefined && f.shoe !== null && String(f.shoe).trim() !== '') {
    shoe = toNumber(f.shoe);
    if (!Number.isInteger(shoe) || shoe < SHOE_EU.min || shoe > SHOE_EU.max) {
      throw httpError(400, `Size giày nên từ ${SHOE_EU.min} đến ${SHOE_EU.max} (size EU).`);
    }
  }
  let fit;
  if (f.mode === 'MEASURE') {
    const height = toNumber(f.height_cm);
    if (!Number.isFinite(height) || height < 120 || height > 220) throw httpError(400, 'Chiều cao nên từ 120 đến 220 cm.');
    const weight = toNumber(f.weight_kg);
    if (!Number.isFinite(weight) || weight < 25 || weight > 150) throw httpError(400, 'Cân nặng nên từ 25 đến 150 kg.');
    fit = { mode: 'MEASURE', height_cm: height, weight_kg: weight, shoe };
  } else if (f.mode === 'SIZE') {
    const top = String(f.top ?? '').trim().toUpperCase();
    if (!SIZE_LETTERS.includes(top)) throw httpError(400, 'Hãy chọn size áo bạn ấy đang mặc.');
    // Size quần cũng là size chữ như áo (cửa hàng bán quần theo size chữ); không nhập thì coi như cùng size áo
    let bottom = null;
    if (f.bottom !== undefined && f.bottom !== null && String(f.bottom).trim() !== '') {
      bottom = String(f.bottom).trim().toUpperCase();
      if (!SIZE_LETTERS.includes(bottom)) throw httpError(400, 'Hãy chọn size quần bạn ấy đang mặc.');
    }
    fit = { mode: 'SIZE', top, bottom, shoe };
  } else {
    throw httpError(400, 'Hãy nhập số đo hoặc size của bạn ấy.');
  }
  return { occasion, budget: Math.round(budget), styles, fit };
}

// Size dùng để lọc mẫu mã. shoe_known: biết CHẮC size giày (người dùng tự nhập); ước lượng theo chiều cao KHÔNG tính.
// Áo / khoác dùng letter + letter_rank; QUẦN dùng bottom_letter + bottom_rank (có thể khác size áo). Quần size số (nếu cửa hàng
// có) được quy ra vòng eo (waist_inch) từ size chữ của quần theo bảng size chung.
function adviceOf(fit) {
  if (fit.mode === 'MEASURE') {
    const a = adviseSize(fit.height_cm, fit.weight_kg);
    return { ...a, bottom_letter: a.letter, bottom_rank: a.letter_rank, shoe_known: fit.shoe !== null, shoe: fit.shoe ?? a.shoe };
  }
  const bottomLetter = fit.bottom ?? fit.top;
  const row = LETTER_SIZES.find((s) => s.size === bottomLetter);
  const waistCm = (row.waist[0] + row.waist[1]) / 2;
  return {
    letter: fit.top,
    letter_rank: letterRank(fit.top),
    bottom_letter: bottomLetter,
    bottom_rank: letterRank(bottomLetter),
    waist_inch: Math.round((waistCm / 2.54) * 10) / 10,
    shoe: fit.shoe,
    shoe_known: fit.shoe !== null,
    too_big: false,
  };
}

// ---- Chấm điểm từng sản phẩm làm quà ----
// Trả null nếu không có mẫu mã đủ tin cậy (giày phải đúng size chắc chắn)
function giftCandidate(product, variants, advice, profile) {
  const role = product.outfit_role;
  if (role === 'SHOES' && !advice.shoe_known) return null;
  // Chưa biết gu thì coi như người thích màu trung tính (khó sai nhất khi tặng)
  const tasteStyles = profile.styles.length ? profile.styles : ['MINIMALIST'];
  // Quần xét theo size quần của bạn ấy (sizeFit so size chữ với letter_rank nên đổi sang size quần)
  const sizeAdvice = role === 'BOTTOM' ? { ...advice, letter: advice.bottom_letter, letter_rank: advice.bottom_rank } : advice;
  const picked = bestVariant(role, variants, sizeAdvice, { styles: tasteStyles });
  if (!picked) return null;
  if (role === 'SHOES' && picked.fit.note !== 'EXACT') return null;

  const productStyles = splitTags(product.styles);
  const productWear = splitTags(product.occasions);
  const wear = OCCASIONS[profile.occasion].wear;
  const wearMatch = productWear.includes(wear);
  const styleMatches = profile.styles.filter((s) => productStyles.includes(s));
  const v = picked.variant;
  const reasons = [];
  let score = 0;

  if (profile.styles.length && productStyles.length) {
    score += styleMatches.length ? 3 + Math.min(styleMatches.length - 1, 2) : -2;
    if (styleMatches.length) reasons.push(`Đúng gu ${styleMatches.slice(0, 2).map((s) => STYLES[s]).join(' & ')} của bạn ấy`);
  }
  if (productWear.length) score += wearMatch ? 2 : -1;
  if (wearMatch) reasons.push(`Hợp để mặc đi ${WEAR[wear].toLowerCase()}`);
  const calm = tasteStyles.some((s) => CALM_STYLES.includes(s));
  if (picked.color.neutral && calm) {
    score += 1.5;
    if (!profile.styles.length || profile.styles.some((s) => NEUTRAL_BONUS_STYLES.includes(s))) reasons.push('Màu trung tính, dễ mặc, khó sai gu');
  }
  if (picked.fit.note === 'EXACT') {
    score += 1;
    reasons.push(advice.mode_size ? `Đúng size ${v.size_name} bạn ấy đang mặc` : `Size ${v.size_name} hợp số đo của bạn ấy`);
  } else if (picked.fit.note === 'NEAR') {
    reasons.push(`Size ${v.size_name} là size gần nhất còn hàng, nên báo bạn ấy có thể đổi size`);
  }
  const rated = Number(product.rating_count) > 0;
  if (rated) score += Math.max(-1, Math.min(1.5, (Number(product.rating_avg) - 3) * 0.75));
  if (rated && Number(product.rating_avg) >= 4) reasons.push(`${Number(product.rating_avg).toFixed(1)} sao từ ${product.rating_count} đánh giá`);
  const sold = Number(product.sold_count) || 0;
  score += (Math.min(sold, 20) / 20) * 1.5;
  if (sold >= 10) reasons.push('Được nhiều người chọn');
  if (Number(v.compare_at_price) > Number(v.price)) { score += 0.3; reasons.push('Đang giảm giá'); }

  return {
    role, product, variant: v, price: Number(v.price), score, reasons: reasons.slice(0, 3),
    color: picked.color, sizeNote: picked.fit.note, wearMatch,
  };
}

// ---- Chọn quà ----
const ANCHOR_ROLES = ['TOP', 'OUTERWEAR', 'BOTTOM', 'SHOES'];
const MAX_MAIN = 4;
const MAX_PER_ROLE = 2;
const MAX_COMBOS = 3;
const MAX_SMALL = 3;
// Điểm cộng khi hai món đi với nhau thành một "combo quà" hợp lý
const PAIR_BONUS = {
  'BOTTOM+TOP': 3, 'ACCESSORY+TOP': 2.5, 'OUTERWEAR+TOP': 2, 'ACCESSORY+OUTERWEAR': 2, 'BOTTOM+SHOES': 1.5,
  'SHOES+TOP': 1.5, 'ACCESSORY+BOTTOM': 1.5, 'BOTTOM+OUTERWEAR': 1, 'ACCESSORY+SHOES': 1, 'OUTERWEAR+SHOES': 0.5,
};
const pairKey = (a, b) => [a.role, b.role].sort().join('+');
const byRoleOrder = (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);

function pickMain(cands, budget) {
  const ranked = cands
    .filter((c) => ANCHOR_ROLES.includes(c.role) && c.price <= budget)
    .map((c) => ({ c, rank: c.score + 2 * (c.price / budget) }))
    .sort((a, b) => b.rank - a.rank || a.c.price - b.c.price || a.c.product.id - b.c.product.id);
  const perRole = {};
  const out = [];
  for (const { c } of ranked) {
    if ((perRole[c.role] ?? 0) >= MAX_PER_ROLE) continue;
    perRole[c.role] = (perRole[c.role] ?? 0) + 1;
    out.push(c);
    if (out.length === MAX_MAIN) break;
  }
  return out;
}

function pickCombos(cands, budget) {
  const pool = cands.filter((c) => c.price < budget);
  const pairs = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i];
      const b = pool[j];
      if (a.role === b.role) continue;
      const total = a.price + b.price;
      if (total > budget) continue;
      const h = harmony([a.color, b.color]);
      pairs.push({ items: [a, b], total, harmony: h, rank: a.score + b.score + (PAIR_BONUS[pairKey(a, b)] ?? 0) + h + 2 * (total / budget) });
    }
  }
  pairs.sort((x, y) => y.rank - x.rank || x.total - y.total);
  // Mỗi sản phẩm chỉ xuất hiện trong một combo để các combo khác hẳn nhau
  const used = new Set();
  const chosen = [];
  for (const p of pairs) {
    if (p.items.some((c) => used.has(c.product.id))) continue;
    p.items.forEach((c) => used.add(c.product.id));
    chosen.push(p);
    if (chosen.length === MAX_COMBOS) break;
  }
  // Còn dư ngân sách thì kèm thêm một phụ kiện (món điểm cao nhất còn vừa, chưa dùng ở combo khác)
  for (const combo of chosen) {
    if (combo.items.some((c) => c.role === 'ACCESSORY')) continue;
    const extra = cands
      .filter((c) => c.role === 'ACCESSORY' && !used.has(c.product.id) && combo.total + c.price <= budget)
      .sort((a, b) => b.score - a.score || a.price - b.price)[0];
    if (!extra) continue;
    used.add(extra.product.id);
    combo.items.push(extra);
    combo.total += extra.price;
    combo.harmony = harmony(combo.items.map((c) => c.color));
  }
  return chosen;
}

function pickSmall(cands, budget, exclude) {
  const cap = Math.min(budget, Math.max(150000, Math.round(budget * 0.35)));
  return cands
    .filter((c) => c.role === 'ACCESSORY' && c.price <= cap && !exclude.has(c.product.id))
    .sort((a, b) => b.score - a.score || a.price - b.price || a.product.id - b.product.id)
    .slice(0, MAX_SMALL);
}

// products: mỗi dòng có id, name, outfit_role, styles, occasions, thumbnail, brand_name, rating_avg, rating_count, sold_count.
// variants: id, product_id, size_name, color_name, hex_code, price, compare_at_price, stock.
function buildGifts(profile, products, variants) {
  const advice = { ...adviceOf(profile.fit), mode_size: profile.fit.mode === 'SIZE' };
  const variantsOf = new Map();
  for (const v of variants) {
    if (!variantsOf.has(v.product_id)) variantsOf.set(v.product_id, []);
    variantsOf.get(v.product_id).push(v);
  }
  const cands = [];
  let hasShoeProducts = false;
  for (const p of products) {
    if (!Object.hasOwn(ROLES, p.outfit_role)) continue;
    if (p.outfit_role === 'SHOES') hasShoeProducts = true;
    const c = giftCandidate(p, variantsOf.get(p.id) ?? [], advice, profile);
    if (c) cands.push(c);
  }

  const budget = profile.budget;
  const main = pickMain(cands, budget);
  const combos = pickCombos(cands, budget);
  const inCombos = new Set(combos.flatMap((c) => c.items.map((i) => i.product.id)));
  const small = pickSmall(cands, budget, inCombos);

  const comboOut = combos.map((combo) => {
    const items = [...combo.items].sort(byRoleOrder);
    const highlights = [];
    if (combo.harmony >= 2) highlights.push('Màu sắc dễ phối với nhau');
    if (items.every((c) => c.sizeNote === 'EXACT' || c.role === 'ACCESSORY')) highlights.push('Đúng size của bạn ấy');
    if (items.some((c) => c.role === 'ACCESSORY')) highlights.push('Đã kèm phụ kiện cho trọn bộ quà');
    return {
      title: items.map((c) => ROLES[c.role]).join(' + '),
      total: combo.total,
      remaining: budget - combo.total,
      items: items.map(itemOf),
      highlights,
    };
  });

  const notes = [];
  if (hasShoeProducts && !advice.shoe_known) {
    notes.push('Chưa gợi ý giày vì giày rất dễ sai size. Nếu bạn biết chắc size giày của bạn ấy, hãy nhập thêm.');
  }
  if (advice.too_big) notes.push('Số đo vượt bảng size tham khảo, hãy xem kỹ số đo từng món hoặc liên hệ cửa hàng để được tư vấn.');

  const empty = !main.length && !comboOut.length && !small.length;
  const out = {
    profile,
    size_advice: {
      letter: advice.letter,
      bottom: advice.bottom_letter,
      shoe: advice.shoe_known ? advice.shoe : null,
      too_big: advice.too_big,
    },
    main: main.map(itemOf),
    combos: comboOut,
    small: small.map(itemOf),
    notes,
  };
  if (empty) {
    const prices = cands.map((c) => c.price);
    if (prices.length) { out.empty_reason = 'BUDGET_TOO_LOW'; out.min_budget = Math.min(...prices); } else out.empty_reason = 'NO_PRODUCT';
  }
  return out;
}

// ---- Thiệp + tùy chọn của đơn quà (người mua nhập ở bước thanh toán) ----
// input: { occasion?, card_template?, card_message?, sender_name?, hide_prices? (mặc định true) }
function parseGiftOrder(input) {
  if (!input || typeof input !== 'object') throw httpError(400, 'Thiếu thông tin quà tặng.');
  const occasion = input.occasion ? String(input.occasion) : 'SURPRISE';
  if (!Object.hasOwn(OCCASIONS, occasion)) throw httpError(400, 'Dịp tặng quà không hợp lệ.');
  // Bỏ ký tự điều khiển (giữ xuống dòng), gọn dòng trống thừa
  const clean = (v) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').trim();
  const message = clean(input.card_message).replace(/\n{3,}/g, '\n\n');
  if ([...message].length > MESSAGE_MAX) throw httpError(400, `Lời nhắn tối đa ${MESSAGE_MAX} ký tự.`);
  const sender = clean(input.sender_name).replace(/\n/g, ' ');
  if ([...sender].length > SENDER_MAX) throw httpError(400, `Tên người gửi tối đa ${SENDER_MAX} ký tự.`);
  let template = input.card_template ? String(input.card_template) : null;
  if (template && !cardOf(template)) throw httpError(400, 'Mẫu thiệp không hợp lệ.');
  if (message && !template) template = CARDS[0].id;
  return {
    occasion,
    card_template: template,
    card_message: message || null,
    sender_name: sender || null,
    hide_prices: input.hide_prices !== false,
  };
}

module.exports = {
  OCCASIONS, CARDS, WISHES, MESSAGE_MAX, SENDER_MAX,
  giftOptions, daysUntil, vnToday, cardOf, parseGiftRequest, adviceOf, buildGifts, parseGiftOrder,
};
