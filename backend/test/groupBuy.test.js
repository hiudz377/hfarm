// Kiểm thử phần tính toán thuần của Mua nhóm (không cần database). Chạy: npm test (trong thư mục backend)
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CODE_ALPHABET, CODE_LENGTH, generateCode, normalizeCode, validateTiers, currentTier, nextTier, capacityOf, groupPrice, groupDiscountAmount,
} = require('../src/services/groupBuy');

const TIERS = [{ min_members: 3, discount_percent: 10 }, { min_members: 5, discount_percent: 20 }];

test('ví dụ của chủ dự án: áo 300.000 ₫, nhóm 3 người 270.000 ₫, nhóm 5 người 240.000 ₫', () => {
  assert.equal(groupPrice(300000, 10), 270000);
  assert.equal(groupPrice(300000, 20), 240000);
  assert.equal(groupDiscountAmount(300000, 10), 30000);
  assert.equal(groupDiscountAmount(300000, 20), 60000);
  // Giá lẻ làm tròn tới đồng, giảm + giá nhóm luôn cộng lại đúng giá gốc
  for (const [price, pct] of [[89000, 10], [429000, 12.5], [1250000, 33.33], [1, 80], [999999, 7.77]]) {
    assert.equal(groupPrice(price, pct) + groupDiscountAmount(price, pct), price);
    assert.ok(Number.isInteger(groupPrice(price, pct)) && groupPrice(price, pct) >= 0 && groupPrice(price, pct) <= price);
  }
});

test('bậc giá hiện tại / kế tiếp / sức chứa theo số người trong nhóm', () => {
  assert.equal(currentTier(TIERS, 1), null);
  assert.equal(currentTier(TIERS, 2), null);
  assert.equal(currentTier(TIERS, 3).discount_percent, 10);
  assert.equal(currentTier(TIERS, 4).discount_percent, 10);
  assert.equal(currentTier(TIERS, 5).discount_percent, 20);
  assert.equal(currentTier(TIERS, 9).discount_percent, 20);
  assert.equal(nextTier(TIERS, 1).min_members, 3);
  assert.equal(nextTier(TIERS, 3).min_members, 5);
  assert.equal(nextTier(TIERS, 5), null);
  assert.equal(capacityOf(TIERS), 5);
  assert.equal(capacityOf([{ min_members: 2, discount_percent: 5 }]), 2);
});

test('kiểm tra bậc giá do CMS gửi: sắp xếp, làm tròn, báo lỗi tiếng Việt', () => {
  assert.deepEqual(validateTiers([{ min_members: 5, discount_percent: '20' }, { min_members: '3', discount_percent: 10.004 }]),
    [{ min_members: 3, discount_percent: 10 }, { min_members: 5, discount_percent: 20 }]);
  const bad = (input, text) => assert.throws(() => validateTiers(input), (e) => e.status === 400 && e.message.includes(text), text);
  bad(undefined, 'ít nhất một bậc');
  bad([], 'ít nhất một bậc');
  bad('3', 'ít nhất một bậc');
  bad(Array.from({ length: 6 }, (_, i) => ({ min_members: i + 2, discount_percent: i + 1 })), 'Tối đa');
  bad([{ min_members: 1, discount_percent: 10 }], 'số nguyên từ 2');
  bad([{ min_members: 51, discount_percent: 10 }], 'số nguyên từ 2');
  bad([{ min_members: 2.5, discount_percent: 10 }], 'số nguyên từ 2');
  bad([{ min_members: 'abc', discount_percent: 10 }], 'số nguyên từ 2');
  bad([{ min_members: 3, discount_percent: 0 }], 'Phần trăm giảm');
  bad([{ min_members: 3, discount_percent: 81 }], 'Phần trăm giảm');
  bad([{ min_members: 3, discount_percent: 'x' }], 'Phần trăm giảm');
  bad([{ min_members: 3, discount_percent: 10 }, { min_members: 3, discount_percent: 20 }], 'cùng số người');
  bad([{ min_members: 3, discount_percent: 20 }, { min_members: 5, discount_percent: 10 }], 'giảm nhiều hơn');
  bad([{ min_members: 3, discount_percent: 10 }, { min_members: 5, discount_percent: 10 }], 'giảm nhiều hơn');
  bad([null], 'số nguyên từ 2');
});

test('mã nhóm: đúng độ dài và bộ ký tự dễ đọc, không trùng, nhập tay lỏng lẻo vẫn nhận', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const c = generateCode();
    assert.equal(c.length, CODE_LENGTH);
    assert.ok([...c].every((ch) => CODE_ALPHABET.includes(ch)));
    assert.equal(normalizeCode(c), c);
    seen.add(c);
  }
  assert.ok(seen.size > 1990, 'hầu như không trùng nhau');
  assert.ok(!/[IO01]/.test(CODE_ALPHABET));
  assert.equal(normalizeCode(' abcd-2efg '), 'ABCD2EFG');
  assert.equal(normalizeCode('abcd 2efg'), 'ABCD2EFG');
  for (const wrong of ['', null, undefined, 'ABC', 'ABCD2EF0', 'ABCD2EFI', "ABCD2EF'; DROP", 'ABCD2EFGH', 12345678]) assert.equal(normalizeCode(wrong), null, String(wrong));
});

// Chạy lại mô phỏng vòng đời nhóm bằng hàm thuần: bất biến "mức giảm chỉ tăng khi thêm người và chưa bao giờ vượt bậc cao nhất"
test('mức giảm tăng dần theo số người và không bao giờ vượt bậc cao nhất (kiểm tra ngẫu nhiên)', () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (let run = 0; run < 300; run++) {
    const n = 1 + Math.floor(rnd() * 5);
    const raw = [];
    let people = 1; let pct = 0;
    for (let i = 0; i < n; i++) { people += 1 + Math.floor(rnd() * 4); pct += 1 + Math.floor(rnd() * 15); raw.push({ min_members: people, discount_percent: Math.min(pct, 80) }); }
    let tiers;
    try { tiers = validateTiers(raw); } catch { continue; } // đầu vào ngẫu nhiên có thể vi phạm (ví dụ cùng 80%): bỏ qua
    let last = 0;
    for (let count = 1; count <= capacityOf(tiers) + 3; count++) {
      const t = currentTier(tiers, count);
      const p = t ? t.discount_percent : 0;
      assert.ok(p >= last, 'không giảm khi thêm người');
      assert.ok(p <= tiers[tiers.length - 1].discount_percent);
      if (t) assert.ok(t.min_members <= count);
      last = p;
    }
  }
});
