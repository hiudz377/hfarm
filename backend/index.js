const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { authenticate, requireRole, assertAuthConfig } = require('./src/middleware/auth');
const { missingMigrations } = require('./src/migrations');
const { expireUnpaidTransfers } = require('./src/services/payments');

try {
  assertAuthConfig();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

// CORS_ORIGIN: danh sách origin được phép, cách nhau dấu phẩy (ví dụ http://localhost:5173).
// Bật xác thực mà không đặt CORS_ORIGIN -> chỉ cho http://localhost:5173 (web CMS).
// Chế độ dev (AUTH_ENABLED=false) không đặt CORS_ORIGIN -> cho mọi origin như trước.
const authEnabled = process.env.AUTH_ENABLED === 'true';
const corsOrigins = (process.env.CORS_ORIGIN || (authEnabled ? 'http://localhost:5173' : ''))
  .split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean);

const app = express();
app.use(corsOrigins.length
  ? cors({
    origin: corsOrigins,
    // Không liệt kê X-Dev-Role: header dev không có tác dụng khi bật xác thực
    allowedHeaders: ['Authorization', 'Content-Type', ...(authEnabled ? [] : ['X-Dev-Role'])],
    maxAge: 600, // mỗi request kèm Authorization đều cần preflight: cho trình duyệt nhớ 10 phút
  })
  : cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => res.json({ message: 'Server HFarm đang chạy!' }));

// Công khai: danh mục, thương hiệu, sản phẩm
app.use('/api', require('./src/routes/catalog'));
// Công khai: đăng ký tài khoản khách trong app (có giới hạn tần suất)
app.use('/api/auth', require('./src/routes/auth'));
// Công khai: phương thức thanh toán đang bật + webhook ngân hàng (webhook tự kiểm tra khóa PAYMENT_WEBHOOK_KEY)
app.use('/api/payments', require('./src/routes/payments'));
// Công khai: ước tính phí giao hàng + tra cứu hành trình theo mã vận đơn
app.use('/api', require('./src/routes/shipping'));
// Công khai: thông tin liên hệ + số ngày đổi trả của cửa hàng (biến STORE_*, RETURN_DAYS)
app.use('/api/store', require('./src/routes/store'));
// Cần đăng nhập (khách hàng)
app.use('/api/me', require('./src/routes/me'));
app.use('/api/cart', require('./src/routes/cart'));
app.use('/api/orders', require('./src/routes/orders'));
app.use('/api/favorites', require('./src/routes/favorites'));
app.use('/api/reviews', require('./src/routes/reviews'));
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

async function start() {
  const missing = await missingMigrations();
  if (missing && missing.length) {
    console.error(`Database chưa áp dụng migration: ${missing.join(', ')}.\n`
      + 'Chạy lần lượt các file trong thư mục database/migrations/ (xem docs/RUNBOOK.md, mục Migration) rồi khởi động lại.');
    process.exit(1);
  }
  app.listen(PORT, () => console.log(`Server chạy tại http://localhost:${PORT}`));

  // Mỗi phút hủy các đơn chuyển khoản quá hạn chưa trả (hoàn kho). Đặt PAYMENT_EXPIRE_JOB=false để tắt.
  if (process.env.PAYMENT_EXPIRE_JOB !== 'false') {
    const tick = () => expireUnpaidTransfers().then((n) => { if (n) console.log(`Đã hủy ${n} đơn quá hạn thanh toán`); }).catch((e) => console.error('Lỗi tác vụ hủy đơn quá hạn:', e));
    tick();
    setInterval(tick, 60 * 1000).unref();
  }
}
start();
