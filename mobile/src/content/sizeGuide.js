// Bảng size tham khảo hiển thị trong app (màn /size-guide) + hàm gợi ý size theo chiều cao, cân nặng.
//
// SỐ ĐO DƯỚI ĐÂY LÀ SỐ LIỆU THAM KHẢO THÔNG DỤNG (người Việt, form vừa người), KHÔNG phải số đo thật của hàng HFarm.
// Chủ cửa hàng nên đối chiếu với bảng size của xưởng/nhà cung cấp rồi sửa lại cho đúng trước khi mở bán.
// Sửa ở đây là đủ, không cần đụng backend hay database. Mỗi khoảng là [nhỏ nhất, lớn nhất].

// Chữ: dùng cho áo và quần size chữ. Khớp tên size trong CMS (XS, S, M, L, XL, XXL).
export const LETTER_SIZES = [
  { size: 'XS', height: [150, 157], weight: [40, 47], chest: [78, 82], waist: [62, 66], hip: [86, 90] },
  { size: 'S', height: [155, 162], weight: [45, 52], chest: [82, 86], waist: [66, 70], hip: [90, 94] },
  { size: 'M', height: [160, 167], weight: [50, 58], chest: [86, 90], waist: [70, 74], hip: [94, 98] },
  { size: 'L', height: [165, 172], weight: [56, 64], chest: [90, 96], waist: [74, 80], hip: [98, 102] },
  { size: 'XL', height: [170, 177], weight: [62, 72], chest: [96, 102], waist: [80, 86], hip: [102, 106] },
  { size: 'XXL', height: [175, 182], weight: [70, 80], chest: [102, 108], waist: [86, 92], hip: [106, 110] },
];

// Size số của quần (vòng eo tính bằng inch): 1 inch = 2,54 cm
export const NUMBER_SIZES = [28, 29, 30, 31, 32, 33, 34, 36].map((inch) => ({ size: String(inch), inch, waistCm: Math.round(inch * 2.54) }));

export const MEASURE_TIPS = [
  'Chiều cao: đứng thẳng, không đi giày, đo từ đỉnh đầu đến gót chân.',
  'Ngực: quấn thước dây quanh phần đầy nhất của ngực, thước song song với mặt đất.',
  'Eo: đo quanh phần nhỏ nhất của thân, thường ngang rốn.',
  'Mông: đo quanh phần đầy nhất của mông.',
  'Nên đo sát người, không kéo căng thước. Nếu số đo nằm giữa hai size, chọn size lớn hơn nếu bạn thích mặc rộng, size nhỏ hơn nếu thích mặc ôm.',
];

export const rangeText = ([a, b]) => `${a}–${b}`;

// Bỏ khoảng trắng, đổi hoa; 2XL = XXL. Dùng để so tên size của sản phẩm với dòng trong bảng.
export const normSize = (name) => {
  const n = String(name ?? '').trim().toUpperCase().replace(/\s+/g, '');
  return n === '2XL' ? 'XXL' : n;
};

// Gợi ý size chữ theo chiều cao (cm) và cân nặng (kg): lấy size lớn hơn trong hai kết quả (theo cân nặng, theo chiều cao).
// Trả về { size } hoặc { error } (nhập sai) hoặc { tooBig: true } (vượt bảng, nên hỏi cửa hàng).
export function suggestSize(heightCm, weightKg) {
  const h = Number(String(heightCm).replace(',', '.'));
  const w = Number(String(weightKg).replace(',', '.'));
  if (!Number.isFinite(h) || h < 120 || h > 220) return { error: 'Chiều cao nên từ 120 đến 220 cm.' };
  if (!Number.isFinite(w) || w < 25 || w > 150) return { error: 'Cân nặng nên từ 25 đến 150 kg.' };
  const byWeight = LETTER_SIZES.findIndex((s) => w <= s.weight[1]);
  const byHeight = LETTER_SIZES.findIndex((s) => h <= s.height[1]);
  if (byWeight === -1 || byHeight === -1) return { tooBig: true };
  return { size: LETTER_SIZES[Math.max(byWeight, byHeight)].size };
}
