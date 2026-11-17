# HFarm - Hệ thống quản lý cửa hàng quần áo

```
HFarm/
├── database/   schema.sql (tạo bảng) + seed.sql (dữ liệu mẫu)
├── backend/    Node.js + Express + MySQL   -> http://localhost:3000
└── web/        React + Vite + Ant Design   -> http://localhost:5173
```

## 1. Database (làm 1 lần)
Mở MySQL Workbench (hoặc phpMyAdmin), chạy lần lượt 2 file:
1. `database/schema.sql`  (tự tạo database `clothing_store`, bảng, size, màu, danh mục)
2. `database/seed.sql`    (sản phẩm, tồn kho, mã giảm giá mẫu)

Lưu ý: schema.sql XÓA và tạo lại toàn bộ bảng mỗi lần chạy.

## 2. Backend (terminal 1)
```
cd backend
npm install
```
Mở file `.env`, sửa `DB_PASSWORD` thành mật khẩu MySQL của bạn. Nếu backend chạy ở địa chỉ công khai, đặt thêm `PUBLIC_URL` bằng origin công khai (ví dụ `https://api.example.com`); mặc định là `http://localhost:3000`. Ảnh tải lên được lưu trong `backend/uploads/` và phục vụ tại `/uploads/<tên-tệp>`. Không đưa các tệp ảnh tải lên vào Git.
Sau đó:
```
npm run dev
```
Thử: http://localhost:3000/api/products

## 3. Web CMS (terminal 2)
```
cd web
npm install
npm run dev
```
Mở http://localhost:5173

## Đăng nhập / Keycloak
Hiện `AUTH_ENABLED=false` trong backend/.env: mọi request coi như tài khoản `DEV_ROLE` (admin).
Đổi `DEV_ROLE=customer` để thử quyền khách hàng. Khi gắn Keycloak thì đổi `AUTH_ENABLED=true`.
Khi `AUTH_ENABLED` khác `true`, request có thể gửi header `X-Dev-Role: admin|staff|customer` để chọn vai trò theo từng request
(app mobile gửi `customer`, web CMS không gửi nên vẫn dùng `DEV_ROLE`) — nhờ vậy CMS và mobile chạy cùng lúc.
Khi `AUTH_ENABLED=true` header này bị bỏ qua hoàn toàn.

## 4. Mobile khách hàng (Expo)
Xem `mobile/README.md` (cần Node >= 22.13).

## Các nhóm API
- Công khai:  GET /api/products, /api/products/:id, /api/categories, /api/brands, /api/sizes, /api/colors
- Khách hàng (cần đăng nhập): /api/me, /api/me/addresses, /api/cart, /api/orders
  - `POST /api/orders/quote`: body `{ "items": [{ "variant_id": 1, "quantity": 2 }], "coupon_code": "SALE10" }` (cả hai tùy chọn; bỏ `items` = lấy từ giỏ). Trả `{ subtotal, discount_amount, shipping_fee, total_amount }`, dùng chung hàm tính với `POST /api/orders` nên luôn khớp; không ghi DB và không kiểm tra tồn kho. Lỗi (mã sai/hết hạn, đơn tối thiểu, giỏ trống...) trả 400 kèm thông báo tiếng Việt.
  - `POST /api/orders` trả thêm `order_code`.
  - `GET /api/orders?status=&page=&limit=`: đơn của chính người đăng nhập, mới nhất trước. `status` là một trạng thái hoặc nhiều trạng thái cách nhau dấu phẩy (`PENDING`, `CONFIRMED,PROCESSING,SHIPPING`...); giá trị lạ trả 400. Mỗi đơn có thêm `item_count` (số dòng hàng) và `first_product_name`.
  - `GET /api/orders/:id` (chi tiết + lịch sử + thanh toán + vận chuyển) và `POST /api/orders/:id/cancel` (chỉ đơn `PENDING`, hoàn kho).
- CMS (admin/staff): /api/admin/products, /inventory, /orders, /categories, /brands, /sizes, /colors, /users, /coupons, /stats

### API CMS bổ sung
- `POST /api/admin/upload`: multipart/form-data, field `file`; chỉ nhận JPG/PNG/WebP tối đa 5 MB, trả `{ "url": "..." }`. URL dùng `PUBLIC_URL`.
- `GET /api/admin/stats/revenue?days=30`: doanh thu và số đơn COMPLETED theo từng ngày (bao gồm ngày không có đơn); `days` từ 1 đến 365.
- `GET /api/admin/stats`: ngoài các chỉ số hiện có, trả thêm `top_products` (5 sản phẩm có tổng số lượng bán cao nhất, bỏ đơn hủy/hoàn trả).
- `POST /api/admin/products/:id/variants/bulk`: tạo nhiều biến thể trong một transaction, body `{ "variants": [{ "size_id": 1, "color_id": 1, "sku": "...", "price": 100000, "quantity": 5 }] }` (tối đa 100 biến thể).
- `GET /api/admin/users/:id/orders?page=1&limit=10`: lịch sử đơn hàng và các dòng sản phẩm của khách hàng, có phân trang.
