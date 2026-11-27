import api from './client';

// Mua nhóm. Chi tiết một nhóm (mọi hàm dưới đây trả về dạng này, trừ fetchMyGroups):
// { code, status: OPEN | SUCCESS | FAILED | CANCELLED, share: { code, url, deep_link },
//   product: { id, name, thumbnail, price_from }, tiers: [{ min_members, discount_percent }],
//   member_count, capacity, current_tier, next_tier, members_to_next, active_percent,
//   seconds_left (nhóm đang mở), claim_seconds_left (đã chốt thành công: còn bao lâu để mua giá nhóm),
//   final_members, final_percent, members: [{ name (đã che), is_leader, is_me }],
//   me: null (chưa tham gia / chưa đăng nhập) | { is_leader, variant: { id, size_name, color_name, price, stock },
//       price_now, discount_now, claim: WAIT | CAN_CLAIM | CLAIMED | EXPIRED | NONE, order_id } }
// Không thu tiền lúc tham gia: chỉ trả khi mua (nhóm chốt thành công thì thêm mẫu mã đã chọn vào giỏ, báo giá tự giảm).

// Xem công khai; có đăng nhập thì kèm "me"
export const fetchGroup = (code) => api.get(`/groups/${encodeURIComponent(code)}`).then((r) => r.data);

// [{ code, status, product_name, thumbnail, member_count, capacity, current_percent, is_leader, seconds_left, claim, claim_seconds_left }]
export const fetchMyGroups = () => api.get('/groups/mine').then((r) => r.data);

export const createGroup = ({ productId, variantId }) =>
  api.post('/groups', { product_id: productId, variant_id: variantId }).then((r) => r.data);

export const joinGroup = ({ code, variantId }) =>
  api.post(`/groups/${encodeURIComponent(code)}/join`, { variant_id: variantId }).then((r) => r.data);

export const changeGroupVariant = ({ code, variantId }) =>
  api.put(`/groups/${encodeURIComponent(code)}/variant`, { variant_id: variantId }).then((r) => r.data);

export const leaveGroup = (code) => api.post(`/groups/${encodeURIComponent(code)}/leave`).then((r) => r.data);
export const cancelGroup = (code) => api.post(`/groups/${encodeURIComponent(code)}/cancel`).then((r) => r.data);
