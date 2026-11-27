import api from './client';

// GET /stylist/options -> { roles: [{ value, label }], styles, occasions, budget: { min, max }, max_styles }
// (styles / occasions: mã + nhãn tiếng Việt do backend quyết định. Cửa hàng chỉ bán đồ nam nên không có giới tính)
export const fetchStylistOptions = () => api.get('/stylist/options').then((r) => r.data);

// POST /stylist/outfits { height_cm, weight_kg, styles: [..], occasion, budget }
//   -> { size_advice: { letter, shoe, shoe_estimated, too_big }, notes: [chữ],
//        outfits: [{ key: BEST | SAVER | ALT, label, total, remaining, highlights: [chữ],
//                    items: [{ role, role_label, product_id, name, thumbnail, variant_id, size_name, color_name, hex_code,
//                              price, compare_at_price, size_note: EXACT | NEAR | null, reasons: [chữ] }],
//                    skipped: [{ role, role_label, reason: OVER_BUDGET | NO_PRODUCT, need_budget? }] }],
//        empty_reason?: BUDGET_TOO_LOW | NO_PRODUCT, min_budget?, missing_roles? }
// Công khai, không lưu gì ở server. Mua bộ đồ vẫn đi qua giỏ hàng (addToCart từng món).
export const fetchOutfits = (profile) => api.post('/stylist/outfits', profile).then((r) => r.data);
