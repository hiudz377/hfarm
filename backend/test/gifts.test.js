// Kiểm thử Quà tặng (không cần database). Chạy: npm test (trong thư mục backend)
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  OCCASIONS, CARDS, WISHES, MESSAGE_MAX, giftOptions, daysUntil, vnToday, cardOf, parseGiftRequest, buildGifts, parseGiftOrder,
} = require('../src/services/gifts');

// ---- Dữ liệu mẫu giống cửa hàng thật ----
let nextId = 1;
let nextVariant = 1;
const COLORS = {
  trang: ['Trắng', '#FFFFFF'], den: ['Đen', '#000000'], navy: ['Xanh navy', '#000080'], do: ['Đỏ', '#FF0000'], vang: ['Vàng', '#ece813'],
};
function catalog() {
  nextId = 1;
  nextVariant = 1;
  const products = [];
  const variants = [];
  const add = (p, sizes, colors, price, stock = 5, extra = {}) => {
    const made = { id: nextId++, styles: '', occasions: '', thumbnail: null, brand_name: null, rating_avg: null, rating_count: 0, sold_count: 0, ...p };
    products.push(made);
    for (const size of sizes) {
      for (const c of colors) {
        variants.push({ id: nextVariant++, product_id: made.id, size_name: size, color_name: COLORS[c][0], hex_code: COLORS[c][1], price, compare_at_price: null, stock, ...extra });
      }
    }
    return made;
  };
  const L = ['S', 'M', 'L', 'XL'];
  add({ name: 'Áo sơ mi trắng', outfit_role: 'TOP', styles: 'MINIMALIST,ELEGANT', occasions: 'WORK,DATE' }, L, ['trang'], 400000);
  add({ name: 'Áo thun basic', outfit_role: 'TOP', styles: 'CASUAL', occasions: 'HANGOUT' }, L, ['trang', 'den'], 150000);
  add({ name: 'Áo polo đỏ', outfit_role: 'TOP', styles: 'CASUAL' }, L, ['do'], 300000);
  add({ name: 'Quần âu', outfit_role: 'BOTTOM', styles: 'MINIMALIST,ELEGANT', occasions: 'WORK,DATE' }, L, ['den', 'navy'], 400000);
  add({ name: 'Quần jean', outfit_role: 'BOTTOM', styles: 'CASUAL' }, ['28', '30', '32', '34'], ['navy'], 350000);
  add({ name: 'Áo khoác bomber', outfit_role: 'OUTERWEAR', styles: 'STREETWEAR' }, L, ['den'], 600000);
  add({ name: 'Giày tây', outfit_role: 'SHOES', styles: 'ELEGANT', occasions: 'WORK,DATE' }, ['41', '42', '43'], ['den'], 500000);
  add({ name: 'Thắt lưng da', outfit_role: 'ACCESSORY', styles: 'ELEGANT,MINIMALIST' }, ['Free size'], ['den'], 90000);
  add({ name: 'Ví da', outfit_role: 'ACCESSORY' }, ['Free size'], ['den'], 250000);
  add({ name: 'Tất nam', outfit_role: 'ACCESSORY' }, ['Free size'], ['trang'], 40000);
  // Gói quà: không gắn vai trò nên không bao giờ được gợi ý làm quà
  add({ name: 'Gói quà', outfit_role: null }, ['Free size'], ['trang'], 20000);
  // Dữ liệu cũ trong database (DRESS): bị bỏ qua
  add({ name: 'Váy hoa', outfit_role: 'DRESS' }, L, ['do'], 600000);
  return { products, variants };
}

const bySize = (o = {}) => parseGiftRequest({ occasion: 'BIRTHDAY', budget: 700000, fit: { mode: 'SIZE', top: 'L' }, ...o });
const allItems = (r) => [...r.main, ...r.combos.flatMap((c) => c.items), ...r.small];

test('danh sách lựa chọn: mỗi dịp có lời chúc, mọi mẫu thiệp hợp lệ và có đủ trường để vẽ', () => {
  const opts = giftOptions();
  for (const code of Object.keys(OCCASIONS)) {
    assert.ok(WISHES[code]?.length >= 3, `dịp ${code} có lời chúc`);
    for (const w of WISHES[code]) assert.ok([...w].length <= MESSAGE_MAX, 'lời chúc không vượt giới hạn lời nhắn');
  }
  assert.equal(opts.occasions.length, Object.keys(OCCASIONS).length);
  const ids = new Set(CARDS.map((c) => c.id));
  assert.equal(ids.size, CARDS.length, 'mã thiệp không trùng');
  for (const c of CARDS) {
    assert.match(c.bg, /^#[0-9A-F]{6}$/i);
    assert.match(c.ink, /^#[0-9A-F]{6}$/i);
    assert.match(c.accent, /^#[0-9A-F]{6}$/i);
    assert.ok(['serif', 'sans'].includes(c.font));
    assert.ok(['double', 'solid', 'dashed', 'none'].includes(c.border));
    for (const o of c.occasions) assert.ok(Object.hasOwn(OCCASIONS, o), `thiệp ${c.id} nhắc dịp có thật`);
  }
  // Dịp nào cũng có ít nhất một mẫu thiệp riêng hoặc dùng chung
  for (const code of Object.keys(OCCASIONS)) assert.ok(CARDS.some((c) => !c.occasions.length || c.occasions.includes(code)));
  assert.equal(cardOf('rose-romance').ornament, '♥');
  assert.equal(cardOf('khong-co'), null);
});

test('đếm ngược tới dịp theo giờ Việt Nam, qua năm mới và đúng ngày', () => {
  // 2026-11-27 12:00 giờ VN (UTC+7)
  const now = new Date('2026-11-27T05:00:00Z');
  assert.deepEqual(vnToday(now), { y: 2026, m: 11, d: 27 });
  assert.equal(daysUntil(12, 24, now), 27);
  assert.equal(daysUntil(2, 14, now), 79); // 14/2/2027
  assert.equal(daysUntil(11, 27, now), 0, 'đúng hôm nay thì còn 0 ngày');
  assert.equal(daysUntil(11, 19, now), 357, 'dịp đã qua năm nay thì tính sang năm sau');
  // 23:30 UTC ngày 26 đã là sáng 27 ở Việt Nam
  assert.deepEqual(vnToday(new Date('2026-11-26T23:30:00Z')), { y: 2026, m: 11, d: 27 });
  const opts = giftOptions(now);
  assert.equal(opts.occasions.find((o) => o.value === 'CHRISTMAS').days_left, 27);
  assert.equal(opts.occasions.find((o) => o.value === 'BIRTHDAY').days_left, null, 'sinh nhật không có ngày cố định');
  assert.equal(opts.occasions.find((o) => o.value === 'TET').days_left, null, 'Tết âm lịch không đếm ngược');
});

test('kiểm tra dữ liệu xin gợi ý: dịp, ngân sách, size, số đo, giày', () => {
  const bad = (body, re) => assert.throws(() => parseGiftRequest(body), (e) => e.status === 400 && re.test(e.message));
  const ok = { occasion: 'BIRTHDAY', budget: 500000, fit: { mode: 'SIZE', top: 'L' } };
  assert.doesNotThrow(() => parseGiftRequest(ok));
  bad({ ...ok, occasion: 'XYZ' }, /dịp/i);
  bad({ ...ok, budget: 50 }, /Ngân sách/);
  bad({ ...ok, styles: ['KHONGCO'] }, /Phong cách/);
  bad({ ...ok, styles: ['CASUAL', 'SPORTY', 'KOREAN', 'VINTAGE'] }, /tối đa/);
  bad({ ...ok, fit: { mode: 'SIZE', top: 'Q' } }, /size áo/);
  bad({ ...ok, fit: { mode: 'SIZE', top: 'L', bottom: 'Q' } }, /size quần/);
  bad({ ...ok, fit: { mode: 'SIZE', top: 'L', bottom: 32 } }, /size quần/); // size số (inch) không còn được nhận
  bad({ ...ok, fit: { mode: 'SIZE', top: 'L', shoe: 20 } }, /Size giày/);
  bad({ ...ok, fit: { mode: 'MEASURE', height_cm: 300, weight_kg: 60 } }, /Chiều cao/);
  bad({ ...ok, fit: { mode: 'MEASURE', height_cm: 170, weight_kg: 5 } }, /Cân nặng/);
  bad({ ...ok, fit: {} }, /số đo hoặc size/);
  const p = parseGiftRequest({ ...ok, fit: { mode: 'SIZE', top: 'l', bottom: 'm', shoe: '42' } });
  assert.deepEqual(p.fit, { mode: 'SIZE', top: 'L', bottom: 'M', shoe: 42 });
  assert.equal(parseGiftRequest({ ...ok, fit: { mode: 'SIZE', top: 'L', bottom: '' } }).fit.bottom, null, 'để trống = cùng size áo');
});

test('quà theo size: mọi món đúng size, còn hàng, không vượt ngân sách, không có váy hay gói quà', () => {
  const { products, variants } = catalog();
  const r = buildGifts(bySize(), products, variants);
  const items = allItems(r);
  assert.ok(r.main.length >= 1 && r.combos.length >= 1);
  assert.ok(items.every((i) => i.price <= 700000));
  for (const c of r.combos) {
    assert.ok(c.total <= 700000, 'combo không vượt ngân sách');
    assert.equal(c.total, c.items.reduce((s, i) => s + i.price, 0));
    assert.equal(c.remaining, 700000 - c.total);
    assert.ok(c.items.length >= 2 && c.items.length <= 3);
    assert.equal(new Set(c.items.map((i) => i.role)).size, c.items.length, 'mỗi vai trò một món');
  }
  assert.ok(!items.some((i) => ['Váy hoa', 'Gói quà'].includes(i.name)));
  // Áo, khoác chọn đúng size L; quần chữ đúng size L
  for (const i of items.filter((x) => ['TOP', 'OUTERWEAR'].includes(x.role))) assert.equal(i.size_name, 'L');
  assert.ok(items.every((i) => i.reasons.length > 0));
  assert.equal(r.size_advice.letter, 'L');
});

test('không nhập size giày thì không gợi ý giày và có lời giải thích', () => {
  const { products, variants } = catalog();
  const r = buildGifts(bySize({ budget: 2000000 }), products, variants);
  assert.ok(!allItems(r).some((i) => i.role === 'SHOES'));
  assert.ok(r.notes.some((n) => /giày/i.test(n)));
  assert.equal(r.size_advice.shoe, null);
});

test('có size giày thì chỉ gợi ý giày đúng size đó, size khác thì loại', () => {
  const { products, variants } = catalog();
  const withShoe = buildGifts(bySize({ budget: 2000000, fit: { mode: 'SIZE', top: 'L', shoe: 42 } }), products, variants);
  const shoes = allItems(withShoe).filter((i) => i.role === 'SHOES');
  assert.ok(shoes.length >= 1, 'có giày');
  assert.ok(shoes.every((i) => i.size_name === '42'));
  assert.ok(!withShoe.notes.some((n) => /giày/i.test(n)));
  // Cửa hàng chỉ có 41-43; size 44 thì không có giày nào đúng -> không gợi ý (không "gần đúng" cho quà)
  const noMatch = buildGifts(bySize({ budget: 2000000, fit: { mode: 'SIZE', top: 'L', shoe: 45 } }), products, variants);
  assert.ok(!allItems(noMatch).some((i) => i.role === 'SHOES'));
});

test('số đo thay cho size: 1m73, 60kg ra size XL như Stylist; giày ước lượng KHÔNG được dùng', () => {
  const { products, variants } = catalog();
  const r = buildGifts(bySize({ budget: 2000000, fit: { mode: 'MEASURE', height_cm: 173, weight_kg: 60 } }), products, variants);
  assert.equal(r.size_advice.letter, 'XL');
  assert.ok(!allItems(r).some((i) => i.role === 'SHOES'), 'chưa nhập size giày thì không có giày dù có số đo');
  for (const i of allItems(r).filter((x) => x.role === 'TOP')) assert.equal(i.size_name, 'XL');
  const withShoe = buildGifts(bySize({ budget: 2000000, fit: { mode: 'MEASURE', height_cm: 173, weight_kg: 60, shoe: 42 } }), products, variants);
  assert.ok(allItems(withShoe).some((i) => i.role === 'SHOES' && i.size_name === '42'));
});

test('size quần là size CHỮ, tách riêng khỏi size áo; không nhập thì cùng size áo', () => {
  const { products, variants } = catalog();
  const pants = (r) => allItems(r).filter((i) => i.role === 'BOTTOM');
  // Áo L, quần M: áo ra size L, quần ra size M
  const diff = buildGifts(bySize({ budget: 1500000, fit: { mode: 'SIZE', top: 'L', bottom: 'M' } }), products, variants);
  assert.ok(allItems(diff).filter((i) => i.role === 'TOP').every((i) => i.size_name === 'L'));
  const letterPants = pants(diff).filter((i) => i.name === 'Quần âu');
  assert.ok(letterPants.length >= 1 && letterPants.every((i) => i.size_name === 'M'), 'quần size chữ theo size quần M');
  assert.equal(diff.size_advice.letter, 'L');
  assert.equal(diff.size_advice.bottom, 'M');
  // Không nhập size quần: dùng size áo
  const same = buildGifts(bySize({ budget: 1500000, fit: { mode: 'SIZE', top: 'XL' } }), products, variants);
  assert.equal(same.size_advice.bottom, 'XL');
  assert.ok(pants(same).filter((i) => i.name === 'Quần âu').every((i) => i.size_name === 'XL'));
  // Cửa hàng có thêm quần size SỐ (jean 28-34): quy ra vòng eo từ size chữ của quần (M ~ 28 inch, L ~ 30 inch)
  const jeans = (letter) => pants(buildGifts(bySize({ budget: 1500000, fit: { mode: 'SIZE', top: 'L', bottom: letter } }), products, variants))
    .filter((i) => i.name === 'Quần jean');
  assert.ok(jeans('M').every((i) => i.size_name === '28'), 'quần M -> jean 28');
  assert.ok(jeans('L').every((i) => i.size_name === '30'), 'quần L -> jean 30');
});

test('số đo thì size quần theo bảng chung, ghi trong size_advice', () => {
  const { products, variants } = catalog();
  const r = buildGifts(bySize({ budget: 2000000, fit: { mode: 'MEASURE', height_cm: 173, weight_kg: 60 } }), products, variants);
  assert.equal(r.size_advice.letter, 'XL');
  assert.equal(r.size_advice.bottom, 'XL');
  assert.ok(allItems(r).filter((i) => i.name === 'Quần âu').every((i) => i.size_name === 'XL'));
});

test('chưa biết gu thì ưu tiên màu trung tính; có gu thì món đúng gu lên trước', () => {
  const { products, variants } = catalog();
  const neutral = buildGifts(bySize({ budget: 450000 }), products, variants);
  // Áo thun có cả màu trắng và đen (đều trung tính); áo polo chỉ có màu đỏ (nổi bật) nên xếp sau
  const top = neutral.main.filter((i) => i.role === 'TOP').map((i) => i.name);
  assert.ok(top.indexOf('Áo thun basic') < top.indexOf('Áo polo đỏ') || !top.includes('Áo polo đỏ'));
  const casual = buildGifts(bySize({ styles: ['CASUAL'], budget: 450000 }), products, variants);
  assert.equal(casual.main.find((i) => i.role === 'TOP').reasons.some((t) => /Đúng gu/.test(t)), true);
});

test('quà nhỏ chỉ là phụ kiện rẻ, không trùng với phụ kiện đã nằm trong combo', () => {
  const { products, variants } = catalog();
  for (const budget of [160000, 300000, 700000, 1500000]) {
    const r = buildGifts(bySize({ budget }), products, variants);
    assert.ok(r.small.every((i) => i.role === 'ACCESSORY' && i.price <= Math.max(150000, Math.round(budget * 0.35))), `ngân sách ${budget}`);
    const inCombo = new Set(r.combos.flatMap((c) => c.items.map((i) => i.product_id)));
    assert.ok(r.small.every((i) => !inCombo.has(i.product_id)), `ngân sách ${budget}`);
  }
  // Ngân sách nhỏ: chưa đủ ghép combo nên các phụ kiện rẻ hiện ở "quà nhỏ" (thắt lưng 90.000 ₫, tất 40.000 ₫)
  const small = buildGifts(bySize({ budget: 160000 }), products, variants);
  assert.equal(small.combos.length, 0);
  assert.deepEqual(small.small.map((i) => i.name).sort(), ['Thắt lưng da', 'Tất nam']);
});

test('mỗi sản phẩm chỉ nằm trong một combo', () => {
  const { products, variants } = catalog();
  const r = buildGifts(bySize({ budget: 1500000 }), products, variants);
  const ids = r.combos.flatMap((c) => c.items.map((i) => i.product_id));
  assert.equal(new Set(ids).size, ids.length);
});

test('hết hàng size đó thì loại; ngân sách quá thấp thì báo mức tối thiểu', () => {
  const { products, variants } = catalog();
  // Hết mọi mẫu mã size L: không còn áo/quần/khoác chữ nào đúng size, chỉ còn quần jean size số và phụ kiện
  const noL = variants.map((v) => (v.size_name === 'L' ? { ...v, stock: 0 } : v));
  const r = buildGifts(bySize({ fit: { mode: 'SIZE', top: 'L' }, budget: 2000000 }), products, noL);
  // Size L hết thì có thể gợi ý size XL (lớn hơn 1 bậc), nhưng không bao giờ gợi ý mẫu mã hết hàng
  assert.ok(allItems(r).every((i) => i.stock > 0));
  assert.ok(allItems(r).filter((i) => i.role === 'TOP').every((i) => i.size_name !== 'L'));

  const tiny = buildGifts(bySize({ budget: 100000 }), products, variants);
  assert.ok(allItems(tiny).every((i) => i.price <= 100000));
  const none = buildGifts(bySize({ budget: 100000 }), products.filter((p) => p.outfit_role === 'SHOES'), variants);
  assert.equal(none.empty_reason, 'NO_PRODUCT');
  const pricey = products.filter((p) => ['TOP', 'BOTTOM'].includes(p.outfit_role) && p.name !== 'Áo thun basic' && p.name !== 'Áo polo đỏ');
  const broke = buildGifts(bySize({ budget: 100000 }), pricey, variants);
  assert.equal(broke.empty_reason, 'BUDGET_TOO_LOW');
  assert.equal(broke.min_budget, 350000);
});

test('kiểm tra thiệp và tùy chọn của đơn quà', () => {
  const ok = parseGiftOrder({ occasion: 'VALENTINE', card_template: 'rose-romance', card_message: '  Em yêu anh!  ', sender_name: ' Lan ' });
  assert.deepEqual(ok, { occasion: 'VALENTINE', card_template: 'rose-romance', card_message: 'Em yêu anh!', sender_name: 'Lan', hide_prices: true });
  // Không có lời nhắn thì không có thiệp trống; có lời nhắn mà chưa chọn mẫu thì dùng mẫu đầu
  const blank = parseGiftOrder({ hide_prices: false });
  assert.deepEqual(blank, { occasion: 'SURPRISE', card_template: null, card_message: null, sender_name: null, hide_prices: false });
  assert.equal(parseGiftOrder({ card_message: 'Chúc mừng' }).card_template, CARDS[0].id);
  const bad = (input, re) => assert.throws(() => parseGiftOrder(input), (e) => e.status === 400 && re.test(e.message));
  bad(null, /Thiếu/);
  bad({ occasion: 'XYZ' }, /Dịp/);
  bad({ card_template: 'khong-co' }, /Mẫu thiệp/);
  bad({ card_message: 'a'.repeat(MESSAGE_MAX + 1) }, /tối đa/);
  bad({ sender_name: 'b'.repeat(61) }, /tối đa/);
  assert.doesNotThrow(() => parseGiftOrder({ card_message: 'ạ'.repeat(MESSAGE_MAX) }), 'đếm ký tự, không đếm byte');
  // Ký tự điều khiển bị bỏ, xuống dòng được giữ nhưng không quá hai dòng trống liên tiếp
  assert.equal(parseGiftOrder({ card_message: 'a\u0000b\r\nc\n\n\n\nd' }).card_message, 'ab\nc\n\nd');
});

test('ngẫu nhiên 400 lượt: không vượt ngân sách, không trùng sản phẩm trong một combo, giày luôn đúng size đã nhập, đủ hàng', () => {
  const { products, variants } = catalog();
  const stockOf = new Map(variants.map((v) => [v.id, v.stock]));
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const styleKeys = ['MINIMALIST', 'CASUAL', 'STREETWEAR', 'SPORTY', 'ELEGANT', 'KOREAN'];
  let withResult = 0;
  for (let n = 0; n < 400; n++) {
    const budget = Math.round((100000 + rnd() * 2400000) / 1000) * 1000;
    const shoe = rnd() < 0.5 ? pick([40, 41, 42, 43, 44]) : null;
    const fit = rnd() < 0.5
      ? { mode: 'SIZE', top: pick(sizes), bottom: rnd() < 0.5 ? pick(sizes) : null, shoe }
      : { mode: 'MEASURE', height_cm: 150 + Math.floor(rnd() * 40), weight_kg: 45 + Math.floor(rnd() * 50), shoe };
    const styles = rnd() < 0.5 ? [] : [pick(styleKeys)];
    const req = parseGiftRequest({ occasion: pick(Object.keys(OCCASIONS)), budget, styles, fit });
    const r = buildGifts(req, products, variants);
    const items = allItems(r);
    if (items.length) withResult += 1;
    assert.ok(items.every((i) => i.price <= budget), 'món lẻ không vượt ngân sách');
    assert.ok(items.every((i) => stockOf.get(i.variant_id) > 0), 'còn hàng');
    for (const c of r.combos) {
      assert.ok(c.total <= budget);
      assert.equal(new Set(c.items.map((i) => i.product_id)).size, c.items.length);
    }
    for (const s of items.filter((i) => i.role === 'SHOES')) {
      assert.notEqual(shoe, null, 'không biết size giày thì không có giày');
      assert.equal(Number(s.size_name), shoe);
    }
  }
  assert.ok(withResult > 100, `có kết quả ở ${withResult}/400 lượt`);
});
