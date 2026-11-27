// Kiểm thử bộ máy Stylist (không cần database). Chạy: npm test (trong thư mục backend)
const test = require('node:test');
const assert = require('node:assert/strict');
const { adviseSize, buildOutfits, cleanProductTags, parseProfile, stylistOptions, ROLE_ORDER } = require('../src/services/stylist');

// ---- Dữ liệu mẫu giống cửa hàng thật: áo, quần, giày, phụ kiện với giá, size, màu khác nhau ----
let nextId = 1;
const product = (o) => ({
  id: nextId++, styles: '', occasions: '', thumbnail: null, brand_name: null,
  rating_avg: null, rating_count: 0, sold_count: 0, ...o,
});
const COLORS = {
  trang: ['Trắng', '#FFFFFF'], den: ['Đen', '#000000'], navy: ['Xanh navy', '#000080'], do: ['Đỏ', '#FF0000'],
  vang: ['Vàng', '#ece813'], reu: ['Xanh rêu', '#2E7D32'],
};
let nextVariant = 1;
const variantsFor = (p, sizes, colors, price, stock = 5, extra = {}) => sizes.flatMap((size) => colors.map((c) => ({
  id: nextVariant++, product_id: p.id, size_name: size, color_name: COLORS[c][0], hex_code: COLORS[c][1],
  price, compare_at_price: null, stock, ...extra,
})));

function catalog() {
  nextId = 1;
  nextVariant = 1;
  const products = [];
  const variants = [];
  const add = (p, sizes, colors, price, stock, extra) => {
    const made = product(p);
    products.push(made);
    variants.push(...variantsFor(made, sizes, colors, price, stock, extra));
    return made;
  };
  const L = ['S', 'M', 'L', 'XL'];
  add({ name: 'T-shirt basics', outfit_role: 'TOP', styles: 'MINIMALIST,CASUAL', occasions: 'HANGOUT,DATE,SCHOOL' }, L, ['trang', 'den'], 89000);
  add({ name: 'Áo sơ mi trắng', outfit_role: 'TOP', styles: 'MINIMALIST,ELEGANT', occasions: 'WORK,DATE' }, L, ['trang'], 400000);
  add({ name: 'Áo polo', outfit_role: 'TOP', styles: 'CASUAL', occasions: 'WORK,HANGOUT' }, L, ['navy', 'do'], 430000);
  add({ name: 'Quần âu ống đứng', outfit_role: 'BOTTOM', styles: 'MINIMALIST,ELEGANT', occasions: 'WORK,DATE' }, L, ['den', 'navy'], 400000);
  add({ name: 'Quần short', outfit_role: 'BOTTOM', styles: 'CASUAL,SPORTY', occasions: 'HANGOUT,SPORT' }, L, ['den'], 200000);
  add({ name: 'Giày tây', outfit_role: 'SHOES', styles: 'ELEGANT', occasions: 'WORK,DATE,PARTY' }, ['41', '42', '43'], ['den'], 500000);
  add({ name: 'Giày thể thao', outfit_role: 'SHOES', styles: 'SPORTY,CASUAL', occasions: 'HANGOUT,SPORT' }, ['41', '42'], ['trang'], 350000);
  add({ name: 'Thắt lưng da', outfit_role: 'ACCESSORY', styles: 'ELEGANT,MINIMALIST', occasions: 'WORK,DATE' }, ['Free size'], ['den'], 90000);
  // Dữ liệu CŨ trong database (gắn DRESS / FEMALE trước khi cửa hàng chốt chỉ bán đồ nam): phải bị bỏ qua hoàn toàn
  add({ name: 'Váy hoa', outfit_role: 'DRESS', gender: 'FEMALE', styles: 'VINTAGE', occasions: 'DATE,PARTY' }, L, ['do'], 600000);
  add({ name: 'Chưa gắn thẻ', outfit_role: null }, L, ['den'], 50000);
  return { products, variants };
}

const profile = (o = {}) => parseProfile({ height_cm: 173, weight_kg: 60, styles: ['MINIMALIST'], occasion: 'DATE', budget: 700000, ...o });
const names = (outfit) => outfit.items.map((i) => i.name);

test('ví dụ của chủ dự án: nam 1m73, 60kg, Minimalist, hẹn hò, 700.000 ₫', () => {
  const { products, variants } = catalog();
  const r = buildOutfits(profile(), products, variants);
  assert.ok(r.outfits.length >= 1);
  const best = r.outfits[0];
  // Áo + quần đúng phong cách và hoàn cảnh; còn dư tiền nên thêm dây lưng 90.000 ₫ (phụ kiện), nhưng giày tây 500.000 ₫ thì không đủ
  assert.deepEqual(names(best), ['T-shirt basics', 'Quần âu ống đứng', 'Thắt lưng da']);
  assert.equal(best.total, 579000);
  assert.equal(best.remaining, 121000);
  // 173 cm / 60 kg ra XL theo bảng size chung (cùng kết quả với màn Hướng dẫn chọn size)
  assert.equal(r.size_advice.letter, 'XL');
  assert.deepEqual(best.items.slice(0, 2).map((i) => i.size_name), ['XL', 'XL']);
  // Không đủ tiền cho giày tây (500.000 ₫): báo cần bao nhiêu thay vì im lặng
  const shoes = best.skipped.find((s) => s.role === 'SHOES');
  assert.equal(shoes.reason, 'OVER_BUDGET');
  assert.equal(shoes.need_budget, 579000 + 500000);
  assert.ok(best.items.every((i) => i.reasons.length > 0));
});

test('ngân sách 1.000.000 ₫ thì có thêm giày và phụ kiện, tổng không vượt ngân sách', () => {
  const { products, variants } = catalog();
  const r = buildOutfits(profile({ budget: 1000000 }), products, variants);
  const best = r.outfits[0];
  assert.ok(best.items.some((i) => i.role === 'SHOES'), 'có giày');
  assert.ok(best.total <= 1000000);
  assert.equal(best.total, best.items.reduce((s, i) => s + i.price, 0));
  assert.equal(best.remaining, 1000000 - best.total);
  // Giày size 42 (ước lượng theo chiều cao 173 cm, nam)
  assert.equal(best.items.find((i) => i.role === 'SHOES').size_name, '42');
});

test('ngân sách quá thấp: báo mức tối thiểu để ghép được áo + quần', () => {
  const { products, variants } = catalog();
  const r = buildOutfits(profile({ budget: 150000 }), products, variants);
  assert.equal(r.outfits.length, 0);
  assert.equal(r.empty_reason, 'BUDGET_TOO_LOW');
  assert.equal(r.min_budget, 89000 + 400000);
});

test('chưa có sản phẩm cho vai trò cần thiết: báo thiếu vai trò nào', () => {
  const { products, variants } = catalog();
  const r = buildOutfits(profile(), products.filter((p) => p.outfit_role !== 'BOTTOM'), variants);
  assert.equal(r.empty_reason, 'NO_PRODUCT');
  assert.deepEqual(r.missing_roles.map((m) => m.role), ['BOTTOM']);
});

test('sản phẩm chưa gắn thẻ, hết hàng hoặc dữ liệu cũ (váy / đầm, nữ) không bao giờ được chọn', () => {
  const { products, variants } = catalog();
  for (const budget of [500000, 1000000, 3000000]) {
    for (const styles of [['MINIMALIST'], ['VINTAGE']]) {
      const all = buildOutfits(profile({ budget, styles, occasion: 'DATE' }), products, variants).outfits.flatMap(names);
      assert.ok(!all.includes('Chưa gắn thẻ'));
      assert.ok(!all.includes('Váy hoa'), 'váy / đầm (dữ liệu cũ) không được dùng');
    }
  }
  // Hết sạch hàng thì không còn gì để gợi ý
  const out = buildOutfits(profile(), products, variants.map((v) => ({ ...v, stock: 0 })));
  assert.equal(out.outfits.length, 0);
});

test('đúng size: chọn size gần nhất còn hàng, size lệch quá thì bỏ sản phẩm', () => {
  const { products, variants } = catalog();
  // Hết XL của mọi sản phẩm: chỉ còn L (lệch 1 size) -> vẫn dùng được nhưng ghi chú "gần nhất"
  const noXL = variants.filter((v) => v.size_name !== 'XL');
  const near = buildOutfits(profile(), products, noXL).outfits[0];
  const sized = near.items.filter((i) => ['TOP', 'BOTTOM'].includes(i.role));
  assert.ok(sized.length === 2 && sized.every((i) => i.size_name === 'L' && i.size_note === 'NEAR'));
  // Giày: ước lượng 42 cho nam 1m73. Chỉ còn size 38, 39 (lệch hơn 1) thì không chọn giày, chỉ còn 43 (lệch 1) thì dùng được
  const farShoes = variants.filter((v) => !(['41', '42', '43'].includes(v.size_name)) && !['XS'].includes(v.size_name));
  const noShoes = buildOutfits(profile({ budget: 1500000 }), products, [
    ...farShoes, ...variants.filter((v) => ['41', '42', '43'].includes(v.size_name)).map((v) => ({ ...v, size_name: String(Number(v.size_name) - 4) })),
  ]);
  assert.ok(noShoes.outfits.every((o) => !o.items.some((i) => i.role === 'SHOES')), 'size giày lệch quá thì không chọn');
  assert.equal(noShoes.outfits[0].skipped.find((s) => s.role === 'SHOES').reason, 'NO_PRODUCT');
  const only43 = buildOutfits(profile({ budget: 1500000 }), products, variants.filter((v) => !['41', '42'].includes(v.size_name)));
  const shoe = only43.outfits[0].items.find((i) => i.role === 'SHOES');
  assert.equal(shoe.size_name, '43');
  assert.equal(shoe.size_note, 'NEAR');
  // Chỉ còn S và M (lệch 2 size trở lên): không phối được
  const small = variants.filter((v) => ['S', 'M'].includes(v.size_name) || !['S', 'M', 'L', 'XL'].includes(v.size_name));
  assert.equal(buildOutfits(profile(), products, small).outfits.length, 0);
});

test('sai cả hoàn cảnh lẫn phong cách thì loại; sai một trong hai thì chỉ bị trừ điểm', () => {
  const { products, variants } = catalog();
  // Đi học + Casual: quần short (HANGOUT,SPORT / CASUAL,SPORTY) sai hoàn cảnh nhưng đúng phong cách -> vẫn có thể dùng
  const r = buildOutfits(profile({ occasion: 'SCHOOL', styles: ['CASUAL'], budget: 400000 }), products, variants);
  assert.ok(r.outfits.length >= 1);
  assert.ok(r.outfits[0].items.some((i) => i.name === 'Quần short'));
  // Phong cách Vintage + Tập thể thao: áo sơ mi/quần âu sai cả hai -> bị loại
  const sport = buildOutfits(profile({ occasion: 'SPORT', styles: ['VINTAGE'], budget: 2000000 }), products, variants);
  assert.ok(!sport.outfits.flatMap(names).includes('Áo sơ mi trắng'));
});

test('các bộ đưa ra khác nhau về phần lõi (áo + quần), nhãn hợp lý', () => {
  const { products, variants } = catalog();
  const r = buildOutfits(profile({ occasion: 'HANGOUT', styles: ['CASUAL'], budget: 2000000 }), products, variants);
  assert.ok(r.outfits.length >= 2 && r.outfits.length <= 3);
  const cores = r.outfits.map((o) => o.items.filter((i) => ['TOP', 'BOTTOM'].includes(i.role)).map((i) => i.product_id).join('-'));
  assert.equal(new Set(cores).size, cores.length);
  assert.equal(r.outfits[0].key, 'BEST');
  assert.ok(r.outfits.slice(1).every((o) => ['SAVER', 'ALT'].includes(o.key)));
  // Mỗi nhãn chỉ xuất hiện một lần, và bộ "Tiết kiệm hơn" thật sự là bộ rẻ nhất, rẻ hơn bộ đầu trên 10%
  const keys = r.outfits.map((o) => o.key);
  assert.equal(new Set(keys.filter((k) => k !== 'ALT')).size, keys.filter((k) => k !== 'ALT').length);
  const saver = r.outfits.find((o) => o.key === 'SAVER');
  if (saver) {
    assert.ok(saver.total < r.outfits[0].total * 0.9);
    assert.ok(r.outfits.every((o) => o.total >= saver.total || o.key === 'BEST'));
  }
});

test('size theo số đo khớp màn Hướng dẫn chọn size của app', () => {
  assert.equal(adviseSize(173, 60).letter, 'XL'); // chiều cao 173 > 172 nên lên XL
  assert.equal(adviseSize(158, 45).letter, 'S');
  assert.equal(adviseSize(150, 40).letter, 'XS');
  assert.equal(adviseSize(190, 95).too_big, true);
  assert.equal(adviseSize(190, 95).letter, 'XXL');
  assert.equal(adviseSize(173, 60).shoe, 42);
});

test('kiểm tra dữ liệu khách nhập: báo lỗi tiếng Việt, rõ ràng', () => {
  const bad = (o, text) => assert.throws(() => profile(o), (e) => e.status === 400 && e.message.includes(text), text);
  bad({ height_cm: 90 }, 'Chiều cao');
  bad({ height_cm: 'abc' }, 'Chiều cao');
  bad({ weight_kg: 500 }, 'Cân nặng');
  bad({ styles: [] }, 'phong cách');
  bad({ styles: ['MINIMALIST', 'CASUAL', 'SPORTY', 'VINTAGE'] }, 'phong cách');
  bad({ styles: ['KHONG_CO'] }, 'không hợp lệ');
  bad({ occasion: 'DANH_NHAU' }, 'hoàn cảnh');
  bad({ budget: 5000 }, 'Ngân sách');
  bad({ budget: 'rất nhiều' }, 'Ngân sách');
  const ok = parseProfile({ gender: 'FEMALE', height_cm: '160,5', weight_kg: '48', style: 'KOREAN', occasion: 'PARTY', budget: '1500000' });
  assert.equal(ok.height_cm, 160.5);
  assert.deepEqual(ok.styles, ['KOREAN']);
  assert.equal(ok.budget, 1500000);
  // Cửa hàng chỉ bán đồ nam: không có giới tính, gửi thừa cũng bị bỏ qua (app cũ vẫn gọi được)
  assert.equal('gender' in ok, false);
  assert.equal('gender' in profile(), false);
});

test('thẻ sản phẩm do CMS gửi: kiểm tra mã, bỏ trùng, cho phép xóa vai trò', () => {
  assert.deepEqual(cleanProductTags({}), {});
  assert.deepEqual(
    cleanProductTags({ outfit_role: 'SHOES', styles: ['CASUAL', 'CASUAL', 'SPORTY'], occasions: 'DATE,WORK' }),
    { outfit_role: 'SHOES', styles: 'CASUAL,SPORTY', occasions: 'DATE,WORK' },
  );
  // Giới tính không còn là thẻ: CMS cũ gửi lên cũng bị bỏ qua, không lỗi và không ghi
  assert.deepEqual(cleanProductTags({ gender: 'FEMALE' }), {});
  // Váy / đầm không còn là vai trò hợp lệ
  assert.throws(() => cleanProductTags({ outfit_role: 'DRESS' }), { status: 400 });
  assert.deepEqual(cleanProductTags({ outfit_role: '', styles: [] }), { outfit_role: null, styles: '' });
  assert.throws(() => cleanProductTags({ outfit_role: 'HAT' }), { status: 400 });
  assert.throws(() => cleanProductTags({ styles: ['CASUAL', 'X'] }), { status: 400 });
  assert.throws(() => cleanProductTags({ occasions: ['X'] }), { status: 400 });
});

test('danh sách lựa chọn có đủ nhóm cho app và CMS', () => {
  const o = stylistOptions();
  for (const k of ['roles', 'styles', 'occasions']) assert.ok(o[k].length > 0, k);
  assert.ok(!('genders' in o) && !('product_genders' in o), 'không có lựa chọn giới tính');
  assert.deepEqual(o.roles.map((r) => r.value), ['TOP', 'BOTTOM', 'OUTERWEAR', 'SHOES', 'ACCESSORY']);
  assert.equal(o.roles.find((r) => r.value === 'BOTTOM').label, 'Quần');
  assert.ok(o.occasions.some((x) => x.value === 'DATE' && x.label === 'Hẹn hò'));
});

test('phong cách Luxury và Nhật Bản: có trong danh sách, nhận được, và được ưu tiên đúng sản phẩm + màu trung tính', () => {
  const o = stylistOptions();
  assert.deepEqual(o.styles.filter((s) => ['LUXURY', 'JAPANESE'].includes(s.value)).map((s) => s.label), ['Luxury', 'Nhật Bản']);
  assert.deepEqual(parseProfile({ height_cm: 173, weight_kg: 60, styles: ['LUXURY', 'JAPANESE'], occasion: 'DATE', budget: 900000 }).styles, ['LUXURY', 'JAPANESE']);
  assert.deepEqual(cleanProductTags({ styles: ['LUXURY', 'JAPANESE'] }), { styles: 'LUXURY,JAPANESE' });

  // Hai áo cùng giá, cùng hoàn cảnh: chỉ khác phong cách thẻ. Khách chọn Nhật Bản -> áo gắn JAPANESE thắng; chọn Luxury -> áo LUXURY thắng.
  nextId = 1; nextVariant = 1;
  const products = []; const variants = [];
  const add = (p, sizes, colors, price) => { const made = product(p); products.push(made); variants.push(...variantsFor(made, sizes, colors, price)); };
  const L = ['S', 'M', 'L', 'XL'];
  add({ name: 'Áo Nhật', outfit_role: 'TOP', styles: 'JAPANESE', occasions: 'DATE' }, L, ['trang', 'do'], 300000);
  add({ name: 'Áo Luxury', outfit_role: 'TOP', styles: 'LUXURY', occasions: 'DATE' }, L, ['den'], 300000);
  add({ name: 'Quần trơn', outfit_role: 'BOTTOM', styles: '', occasions: '' }, L, ['den'], 300000);
  const pick = (style) => buildOutfits(profile({ styles: [style], budget: 700000 }), products, variants).outfits[0].items.find((i) => i.role === 'TOP');
  assert.equal(pick('JAPANESE').name, 'Áo Nhật');
  assert.equal(pick('LUXURY').name, 'Áo Luxury');
  assert.ok(pick('JAPANESE').reasons.some((r) => r.includes('Nhật Bản')), 'lý do nêu đúng tên phong cách');
  // Ưa màu trung tính: áo Nhật có cả màu Đỏ và Trắng -> chọn Trắng
  assert.equal(pick('JAPANESE').color_name, 'Trắng');
});

// Kiểm thử ngẫu nhiên (hạt giống cố định nên chạy lại ra đúng kết quả): bất biến phải đúng với MỌI cửa hàng và ngân sách
test('ngẫu nhiên 400 lượt: không bao giờ vượt ngân sách, không trùng món, đủ áo + quần, đúng hàng còn', (t) => {
  let seed = 20261126;
  const rnd = () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pickOf = (arr) => arr[Math.floor(rnd() * arr.length)];
  const styles = ['MINIMALIST', 'CASUAL', 'STREETWEAR', 'SPORTY', 'ELEGANT', 'VINTAGE', 'KOREAN', 'LUXURY', 'JAPANESE'];
  const occasions = ['SCHOOL', 'WORK', 'HANGOUT', 'DATE', 'PARTY', 'SPORT', 'TRAVEL'];
  const roles = ['TOP', 'BOTTOM', 'OUTERWEAR', 'SHOES', 'ACCESSORY'];
  const colorKeys = Object.keys(COLORS);
  const some = (arr, max) => arr.filter(() => rnd() < max / arr.length);
  let withOutfits = 0;
  let totalOutfits = 0;
  let withShoes = 0;

  for (let run = 0; run < 400; run++) {
    nextId = 1; nextVariant = 1;
    const products = []; const variants = [];
    for (let i = 0; i < 4 + Math.floor(rnd() * 30); i++) {
      const role = rnd() < 0.05 ? null : pickOf(roles);
      const p = product({
        name: `SP${i}`, outfit_role: role,
        styles: some(styles, 2).join(','), occasions: some(occasions, 2).join(','),
        rating_avg: rnd() < 0.5 ? 1 + rnd() * 4 : null, rating_count: Math.floor(rnd() * 5), sold_count: Math.floor(rnd() * 40),
      });
      products.push(p);
      const sizeSet = role === 'SHOES' ? ['39', '40', '41', '42', '43', '44'] : role === 'ACCESSORY' ? ['Free size'] : ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
      const colors = some(colorKeys, 3);
      for (const size of some(sizeSet, 3)) {
        for (const c of colors.length ? colors : ['den']) {
          const price = 50000 + Math.floor(rnd() * 120) * 10000;
          variants.push({
            id: nextVariant++, product_id: p.id, size_name: size, color_name: COLORS[c][0], hex_code: COLORS[c][1],
            price, compare_at_price: rnd() < 0.2 ? price + 50000 : null, stock: Math.floor(rnd() * 4),
          });
        }
      }
    }
    const pr = profile({
      height_cm: 140 + Math.floor(rnd() * 60), weight_kg: 35 + Math.floor(rnd() * 80),
      styles: some(styles, 1.5).slice(0, 3).concat('CASUAL').slice(0, 3), occasion: pickOf(occasions), budget: 100000 + Math.floor(rnd() * 300) * 10000,
    });
    const r = buildOutfits(pr, products, variants);
    assert.ok(r.outfits.length <= 3);
    if (!r.outfits.length) assert.ok(['NO_PRODUCT', 'BUDGET_TOO_LOW'].includes(r.empty_reason));
    if (r.outfits.length) withOutfits++;
    totalOutfits += r.outfits.length;
    if (r.outfits.some((o) => o.items.some((i) => i.role === 'SHOES'))) withShoes++;
    const cores = new Set();
    for (const o of r.outfits) {
      assert.ok(o.total <= pr.budget, `tổng ${o.total} vượt ngân sách ${pr.budget}`);
      assert.equal(o.remaining, pr.budget - o.total);
      assert.equal(o.total, o.items.reduce((s, i) => s + i.price, 0));
      const roleList = o.items.map((i) => i.role);
      assert.equal(new Set(roleList).size, roleList.length, 'mỗi vai trò chỉ một món');
      assert.ok(roleList.includes('TOP') && roleList.includes('BOTTOM'), 'có áo + quần hoặc váy');
      assert.deepEqual(roleList, [...roleList].sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b)));
      for (const it of o.items) {
        const v = variants.find((x) => x.id === it.variant_id);
        const p = products.find((x) => x.id === it.product_id);
        assert.ok(v && v.product_id === p.id && v.stock > 0, 'mẫu mã thuộc đúng sản phẩm và còn hàng');
        assert.equal(it.price, v.price);
        assert.ok(p.outfit_role === it.role, 'vai trò khớp thẻ sản phẩm');
      }
      const core = o.items.filter((i) => ['TOP', 'BOTTOM'].includes(i.role)).map((i) => i.product_id).join('-');
      assert.ok(!cores.has(core), 'các bộ khác nhau về phần lõi');
      cores.add(core);
    }
  }
  t.diagnostic(`lượt ghép được bộ đồ: ${withOutfits}/400, tổng số bộ: ${totalOutfits}, lượt có giày: ${withShoes}`);
  assert.ok(withOutfits > 20, `phải có một số lượt ghép được bộ đồ (đang có ${withOutfits}/400)`);
});
