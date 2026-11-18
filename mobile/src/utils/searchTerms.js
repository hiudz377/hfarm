// Logic thuần của lịch sử tìm kiếm và tô đậm chữ khớp (không import React Native để kiểm tra riêng được).

export const MAX_HISTORY = 8;

// Gọn khoảng trắng, tối đa 60 ký tự (cùng giới hạn với backend /products/suggest)
export const normalizeTerm = (t) => String(t ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);

// Thêm từ khóa mới lên đầu; trùng (không phân biệt hoa/thường) thì chuyển lên đầu thay vì thêm bản thứ hai
export function addTerm(list, term, max = MAX_HISTORY) {
  const t = normalizeTerm(term);
  if (!t) return list;
  const key = t.toLowerCase();
  return [t, ...list.filter((x) => x.toLowerCase() !== key)].slice(0, max);
}

export const removeTerm = (list, term) => list.filter((x) => x !== term);

// Đọc chuỗi đã lưu: hỏng / sai kiểu thì coi như chưa có lịch sử
export function parseHistory(raw) {
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter((x) => typeof x === 'string' && x.trim()).map(normalizeTerm).filter(Boolean).slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

// Bỏ dấu + hạ chữ thường từng ký tự, giữ nguyên độ dài để chỉ số khớp với chuỗi gốc ("Áo" -> "ao", "Đ" -> "d")
const plain = (s) => [...String(s)].map((c) => c.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()).join('');

// Tách tên thành [trước, khớp, sau] theo chữ đang gõ (không phân biệt hoa/thường và dấu), để tô đậm phần khớp.
// Không khớp (hoặc không giữ được độ dài khi bỏ dấu) thì trả về nguyên tên, không tô.
export function splitMatch(name, query) {
  const text = String(name ?? '');
  const q = plain(normalizeTerm(query));
  if (!q) return { before: text, match: '', after: '' };
  const p = plain(text);
  if (p.length !== text.length) return { before: text, match: '', after: '' };
  const i = p.indexOf(q);
  if (i < 0) return { before: text, match: '', after: '' };
  return { before: text.slice(0, i), match: text.slice(i, i + q.length), after: text.slice(i + q.length) };
}
