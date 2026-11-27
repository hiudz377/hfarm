import api from './client';

// GET /gifts/options (công khai)
//   -> { occasions: [{ value, label, date_text, days_left, budget_default }],
//        cards: [{ id, name, occasions: [mã dịp] (rỗng = hợp mọi dịp), bg, ink, accent, border, ornament, font }],
//        wishes: { <mã dịp>: [lời chúc] }, styles: [{ value, label }], max_styles,
//        budget: { min, max, presets }, sizes: { letters, shoe_eu: { min, max } },
//        message_max, sender_max,
//        wrap: { variant_id, name, price, stock } | null  (sản phẩm "gói quà"; null = cửa hàng chưa bán) }
export const fetchGiftOptions = () => api.get('/gifts/options').then((r) => r.data);

// POST /gifts/suggestions (công khai, không lưu gì ở server)
//   { occasion, budget, styles?: [..], fit: { mode: 'SIZE', top, bottom?, shoe? } | { mode: 'MEASURE', height_cm, weight_kg, shoe? } }
//   -> { size_advice: { letter (áo), bottom (quần, size chữ), shoe, too_big }, notes: [chữ],
//        main: [món], small: [món], combos: [{ title, total, remaining, items: [món], highlights: [chữ] }],
//        empty_reason?: BUDGET_TOO_LOW | NO_PRODUCT, min_budget? }
//   món = { role, role_label, product_id, name, thumbnail, variant_id, size_name, color_name, hex_code, price,
//           compare_at_price, stock, size_note: EXACT | NEAR | null, reasons: [chữ] }
// Mua quà vẫn đi qua giỏ hàng (addToCart từng món).
export const fetchGiftSuggestions = (body) => api.post('/gifts/suggestions', body).then((r) => r.data);

// POST /gifts/checkout { address_id, payment_method: 'BANK_TRANSFER', coupon_code?, customer_note?, gift } (lấy hàng từ giỏ)
//   gift = { occasion?, card_template?, card_message?, sender_name?, hide_prices? }
//   -> { id, order_code, subtotal, discount_amount, shipping_fee, total_amount, shipping_zone, gift }
// COD bị backend từ chối (400). timeout dài hơn mặc định: đặt hàng chạy transaction trừ kho.
export const createGiftOrder = ({ addressId, couponCode, note, gift }) =>
  api
    .post(
      '/gifts/checkout',
      {
        address_id: addressId,
        payment_method: 'BANK_TRANSFER',
        coupon_code: couponCode || undefined,
        customer_note: note || undefined,
        gift,
      },
      { timeout: 20000 },
    )
    .then((r) => r.data);
