const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { authenticate, requireRole } = require('./src/middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => res.json({ message: 'Server HFarm đang chạy!' }));

// Công khai: danh mục, thương hiệu, sản phẩm
app.use('/api', require('./src/routes/catalog'));
// Cần đăng nhập (khách hàng)
app.use('/api/me', require('./src/routes/me'));
app.use('/api/cart', require('./src/routes/cart'));
app.use('/api/orders', require('./src/routes/orders'));
// Chỉ admin / staff (CMS)
app.use('/api/admin', authenticate, requireRole('admin', 'staff'), require('./src/routes/admin'));

app.use((req, res) => res.status(404).json({ error: 'Không tìm thấy đường dẫn' }));

app.use((err, req, res, next) => {
  if (!err.status) console.error(err);
  const map = {
    ER_DUP_ENTRY: [409, 'Dữ liệu bị trùng (ví dụ SKU, tên, mã)'],
    ER_ROW_IS_REFERENCED_2: [409, 'Đang được sử dụng ở nơi khác nên không thể xóa. Hãy chuyển sang ngừng hoạt động'],
    ER_NO_REFERENCED_ROW_2: [400, 'Dữ liệu liên kết không tồn tại (danh mục, size, màu...)'],
    ER_CHECK_CONSTRAINT_VIOLATED: [400, 'Giá trị không hợp lệ (ví dụ giá âm)'],
  };
  if (map[err.code]) return res.status(map[err.code][0]).json({ error: map[err.code][1] });
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Lỗi server' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy tại http://localhost:${PORT}`));
