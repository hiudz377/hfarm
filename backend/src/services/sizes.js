// Phân nhóm size để hiển thị: size chữ (XS, S, M, L, XL, 2XL...) tách riêng khỏi size số (28, 30, 38.5...)
// Suy ra từ tên size nên không cần đổi database: size nào đặt tên lạ (ví dụ "Free size") vào nhóm OTHER.
const GROUPS = ['LETTER', 'NUMBER', 'OTHER'];

const norm = (name) => String(name ?? '').trim().toUpperCase().replace(/\s+/g, '');

function sizeGroup(name) {
  const n = norm(name);
  if (/^(?:\d{1,2}XL|X{1,4}[SL]|[SML])$/.test(n)) return 'LETTER';
  if (/^\d{1,3}(?:[.,]\d+)?$/.test(n)) return 'NUMBER';
  return 'OTHER';
}

// Thứ tự size chữ theo nghĩa (không phụ thuộc sort_order, vì size thêm sau thường có sort_order mặc định 0):
// XXS(0) < XS(1) < S(2) < M(3) < L(4) < XL(5) < XXL = 2XL(6) < XXXL = 3XL(7) ...
function letterRank(name) {
  const n = norm(name);
  if (n === 'S') return 2;
  if (n === 'M') return 3;
  if (n === 'L') return 4;
  let m = /^(\d{1,2})XL$/.exec(n);
  if (m) return 4 + Number(m[1]);
  m = /^(X+)L$/.exec(n);
  if (m) return 4 + m[1].length;
  m = /^(X+)S$/.exec(n);
  if (m) return 2 - m[1].length;
  return 0;
}

// Thêm size_group và sắp xếp: nhóm chữ -> nhóm số -> khác. Chữ theo nghĩa, số theo giá trị số, khác theo sort_order.
function groupSizes(rows) {
  const numeric = (r) => parseFloat(norm(r.name).replace(',', '.'));
  return rows
    .map((r) => ({ ...r, size_group: sizeGroup(r.name) }))
    .sort((a, b) => {
      if (a.size_group !== b.size_group) return GROUPS.indexOf(a.size_group) - GROUPS.indexOf(b.size_group);
      if (a.size_group === 'LETTER') return letterRank(a.name) - letterRank(b.name) || a.id - b.id;
      if (a.size_group === 'NUMBER') return numeric(a) - numeric(b) || a.id - b.id;
      return a.sort_order - b.sort_order || a.id - b.id;
    });
}

module.exports = { sizeGroup, letterRank, groupSizes };
