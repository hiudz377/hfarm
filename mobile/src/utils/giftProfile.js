import AsyncStorage from '@react-native-async-storage/async-storage';

// Nhớ size của bạn nam đã nhập ở màn Quà tặng để lần sau (sinh nhật năm sau...) không phải nhập lại.
// Chỉ lưu trên máy này (AsyncStorage), KHÔNG gửi lên máy chủ ngoài lúc xin gợi ý. Khóa RIÊNG, không dính hồ sơ của Stylist.
// Mọi lỗi đọc/ghi đều bị nuốt: không nhớ được thì màn vẫn chạy với form trống.
const KEY = 'hfarm.gift.fit';

export async function loadGiftFit() {
  try {
    const data = JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null');
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

export async function saveGiftFit(fit) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(fit));
  } catch {
    // bỏ qua: chỉ mất phần "nhớ lần trước"
  }
}

export async function clearGiftFit() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // bỏ qua
  }
}

const num = (v) => Number(String(v ?? '').trim().replace(',', '.'));
const blank = (v) => v === undefined || v === null || String(v).trim() === '';

// Kiểm tra bước "size" (cùng khoảng giá trị và câu chữ với backend/src/services/gifts.js, parseGiftRequest).
// Trả { fields } nếu sai, hoặc { fit } (đúng dạng body.fit) nếu ổn.
export function validateGiftFit(form, options) {
  const fields = {};
  const shoeRange = options?.sizes?.shoe_eu ?? { min: 36, max: 47 };
  let shoe = null;
  if (!blank(form.shoe)) {
    shoe = num(form.shoe);
    if (!Number.isInteger(shoe) || shoe < shoeRange.min || shoe > shoeRange.max) fields.shoe = `Size giày nên từ ${shoeRange.min} đến ${shoeRange.max} (size EU).`;
  }
  if (form.mode === 'MEASURE') {
    const height = num(form.height);
    if (blank(form.height) || !Number.isFinite(height) || height < 120 || height > 220) fields.height = 'Chiều cao nên từ 120 đến 220 cm.';
    const weight = num(form.weight);
    if (blank(form.weight) || !Number.isFinite(weight) || weight < 25 || weight > 150) fields.weight = 'Cân nặng nên từ 25 đến 150 kg.';
    if (Object.keys(fields).length) return { fields };
    return { fit: { mode: 'MEASURE', height_cm: height, weight_kg: weight, shoe } };
  }
  const letters = options?.sizes?.letters ?? ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  if (!form.top) fields.top = 'Hãy chọn size áo bạn ấy đang mặc.';
  // Size quần cũng là size chữ như áo; không chọn = cùng size áo (backend tự xử lý)
  const bottom = blank(form.bottom) ? null : String(form.bottom).trim().toUpperCase();
  if (bottom && !letters.includes(bottom)) fields.bottom = 'Hãy chọn size quần bạn ấy đang mặc.';
  if (Object.keys(fields).length) return { fields };
  return { fit: { mode: 'SIZE', top: form.top, bottom, shoe } };
}

// Kiểm tra bước "gu và ngân sách". Trả { fields } hoặc { styles, budget }.
export function validateGiftTaste(form, options) {
  const fields = {};
  const min = options?.budget?.min ?? 100000;
  const max = options?.budget?.max ?? 100000000;
  const budget = num(form.budget);
  if (blank(form.budget) || !Number.isFinite(budget) || budget < min || budget > max) fields.budget = 'Ngân sách nên từ 100.000 đến 100.000.000 ₫.';
  if (Object.keys(fields).length) return { fields };
  return { styles: form.styles, budget: Math.round(budget) };
}
