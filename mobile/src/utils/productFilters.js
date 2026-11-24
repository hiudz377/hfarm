// Bộ lọc + sắp xếp của màn Cửa hàng. Thuần JS (không import React Native) để dễ kiểm tra riêng.

// label: nhãn đầy đủ trong bảng lọc; short: nhãn ngắn cho dòng tóm tắt trên thanh công cụ (chỗ hẹp)
export const SORT_OPTIONS = [
  { key: 'newest', label: 'Mới nhất', short: 'Mới nhất' },
  { key: 'bestseller', label: 'Bán chạy', short: 'Bán chạy' },
  { key: 'price_asc', label: 'Giá thấp đến cao', short: 'Giá tăng' },
  { key: 'price_desc', label: 'Giá cao đến thấp', short: 'Giá giảm' },
];

// Các khoảng không chồng nhau (giá là số nguyên đồng). min/max đều tính cả biên ở backend.
export const PRICE_RANGES = [
  { key: 'under200', label: 'Dưới 200.000 ₫', max: 199999 },
  { key: '200to500', label: '200.000 – 500.000 ₫', min: 200000, max: 499999 },
  { key: '500to1m', label: '500.000 ₫ – 1 triệu', min: 500000, max: 999999 },
  { key: 'over1m', label: 'Từ 1 triệu trở lên', min: 1000000 },
];

export const DEFAULT_SORT = 'newest';
export const EMPTY_FILTERS = { sort: DEFAULT_SORT, priceKey: null, sizeIds: [], colorIds: [], brandIds: [], inStock: false, onSale: false };

export const sortShortLabel = (key) => (SORT_OPTIONS.find((o) => o.key === key) ?? SORT_OPTIONS[0]).short;

// Số nhóm bộ lọc đang bật (không tính sắp xếp): dùng cho dấu số trên nút "Lọc"
export function activeFilterCount(f) {
  return (f.priceKey ? 1 : 0) + (f.sizeIds.length ? 1 : 0) + (f.colorIds.length ? 1 : 0) + (f.brandIds.length ? 1 : 0) + (f.inStock ? 1 : 0) + (f.onSale ? 1 : 0);
}

// Bật/tắt một id trong danh sách và giữ thứ tự tăng dần để khóa React Query ổn định (chọn 1,2 hay 2,1 là một)
export function toggleId(list, id) {
  const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  return next.sort((a, b) => a - b);
}

// Xóa bộ lọc nhưng giữ kiểu sắp xếp đang chọn
export const clearFilters = (f) => ({ ...EMPTY_FILTERS, sort: f.sort });

// Chuyển state bộ lọc thành tham số query của GET /products. Giá trị trống -> undefined (axios bỏ qua).
export function filterParams(f) {
  const range = PRICE_RANGES.find((r) => r.key === f.priceKey);
  const list = (ids) => (ids.length ? ids.join(',') : undefined);
  return {
    sort: f.sort && f.sort !== DEFAULT_SORT ? f.sort : undefined,
    min_price: range?.min,
    max_price: range?.max,
    size_id: list(f.sizeIds),
    color_id: list(f.colorIds),
    brand_id: list(f.brandIds),
    in_stock: f.inStock ? 1 : undefined,
    on_sale: f.onSale ? 1 : undefined,
  };
}
