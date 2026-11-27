import AsyncStorage from '@react-native-async-storage/async-storage';

// Nhớ thông tin khách đã nhập ở màn Stylist (giới tính, số đo, phong cách, hoàn cảnh, ngân sách) để lần sau không phải nhập lại.
// Chỉ lưu trên máy này (AsyncStorage), không gửi đi đâu ngoài lúc xin gợi ý. Mọi lỗi đọc/ghi đều bị nuốt: không nhớ được thì
// màn vẫn chạy bình thường với form trống.
const KEY = 'hfarm.stylist.profile';

export async function loadStylistProfile() {
  try {
    const data = JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null');
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

export async function saveStylistProfile(profile) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // bỏ qua: chỉ mất phần "nhớ lần trước"
  }
}

// Kiểm tra dữ liệu khách nhập ở app (cùng khoảng giá trị và câu chữ với backend/src/services/stylist.js, parseProfile).
// Trả về { fields: { ...lỗi theo ô } } nếu sai, hoặc { profile } nếu ổn (số đã đổi sang số).
export function validateStylistForm(form, options) {
  const fields = {};
  const num = (v) => Number(String(v ?? '').trim().replace(',', '.'));
  const height = num(form.height);
  if (!form.height || !Number.isFinite(height) || height < 120 || height > 220) fields.height = 'Chiều cao nên từ 120 đến 220 cm.';
  const weight = num(form.weight);
  if (!form.weight || !Number.isFinite(weight) || weight < 25 || weight > 150) fields.weight = 'Cân nặng nên từ 25 đến 150 kg.';
  const max = options?.max_styles ?? 3;
  if (!form.styles.length || form.styles.length > max) fields.styles = `Hãy chọn từ 1 đến ${max} phong cách.`;
  if (!form.occasion) fields.occasion = 'Hãy chọn hoàn cảnh.';
  const min = options?.budget?.min ?? 100000;
  const top = options?.budget?.max ?? 100000000;
  const budget = num(form.budget);
  if (!form.budget || !Number.isFinite(budget) || budget < min || budget > top) fields.budget = 'Ngân sách nên từ 100.000 đến 100.000.000 ₫.';
  if (Object.keys(fields).length) return { fields };
  return {
    profile: { height_cm: height, weight_kg: weight, styles: form.styles, occasion: form.occasion, budget: Math.round(budget) },
  };
}
