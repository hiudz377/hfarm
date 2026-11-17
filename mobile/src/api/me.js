import api from './client';

// GET /me -> { id, email, full_name, phone, avatar_url, user_type, created_at, roles }
export const fetchMe = () => api.get('/me').then((r) => r.data);

// PUT /me { full_name, phone } -> { message }  (backend chỉ nhận full_name, phone, avatar_url)
export const updateMe = (fields) => api.put('/me', fields).then((r) => r.data);
