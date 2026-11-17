import api from './client';

// GET /me/addresses -> [{ id, recipient_name, phone, province, district, ward, address_detail, is_default }]
// (mặc định xếp trước; is_default là 0/1)
export const fetchAddresses = () => api.get('/me/addresses').then((r) => r.data);

// POST /me/addresses { recipient_name, phone, province, district, ward, address_detail, is_default } -> { id }
// Địa chỉ đầu tiên của người dùng luôn được backend đặt làm mặc định.
export const createAddress = (address) => api.post('/me/addresses', address).then((r) => r.data);

// PUT /me/addresses/:id { ...các trường cần đổi } -> { message }. Gửi is_default: true thì backend bỏ mặc định của địa chỉ khác.
export const updateAddress = ({ id, ...fields }) => api.put(`/me/addresses/${id}`, fields).then((r) => r.data);

// DELETE /me/addresses/:id -> { message }. Backend KHÔNG tự chọn địa chỉ mặc định khác khi xóa địa chỉ mặc định.
export const deleteAddress = (id) => api.delete(`/me/addresses/${id}`).then((r) => r.data);
