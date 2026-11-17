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
Có hai chế độ, chọn bằng `AUTH_ENABLED` trong `backend/.env`.

### Chế độ dev (mặc định, `AUTH_ENABLED=false`) — không cần Keycloak
Mọi request coi như tài khoản `DEV_ROLE` (mặc định admin). Request có thể gửi header
`X-Dev-Role: admin|staff|customer` để chọn vai trò theo từng request (app mobile gửi `customer`).
Web CMS mặc định vẫn đòi đăng nhập Keycloak; muốn chạy CMS mà không có Keycloak, thêm vào `web/.env`:
`VITE_AUTH_DISABLED=true` (và tùy chọn `VITE_DEV_ROLE=staff` để thử giao diện nhân viên; web gửi vai trò này qua `X-Dev-Role`).

### Chế độ Keycloak (`AUTH_ENABLED=true`)
Backend bắt buộc header `Authorization: Bearer <token>` và kiểm tra chữ ký (JWKS), issuer, hạn dùng; vai trò lấy từ claim
`realm_access.roles`. `DEV_ROLE` và `X-Dev-Role` bị bỏ qua hoàn toàn. Đã thử với Keycloak 26.8.1.

**1. Chạy Keycloak** (ví dụ bằng Docker; tự đặt tên và mật khẩu quản trị, không đưa vào Git):
```
docker run --name keycloak-hfarm -p 8080:8080 -e KC_BOOTSTRAP_ADMIN_USERNAME=<tên-quản-trị> -e KC_BOOTSTRAP_ADMIN_PASSWORD=<mật-khẩu> quay.io/keycloak/keycloak:26.8.1 start-dev
```
Mở http://localhost:8080 và đăng nhập trang quản trị Keycloak. Cổng 8080 phải còn trống.

**2. Cấu hình trong Keycloak** (làm 1 lần):
- Tạo realm `hfarm`.
- Realm roles: `admin`, `staff`, `customer`.
- Clients → tạo client `hfarm-web`: **Client authentication = Off** (public client), bật **Standard flow**,
  bật PKCE với phương thức **S256** (mục Advanced của client), Valid redirect URIs `http://localhost:5173/*`, Web origins `http://localhost:5173`.
  Web luôn đăng nhập theo kiểu Authorization Code + PKCE S256, thiếu PKCE là Keycloak từ chối.
- Users → tạo người dùng (phải có email: backend dùng email làm khóa duy nhất ở bảng `users`), đặt mật khẩu,
  rồi gán realm role ở tab Role mapping. Chỉ `admin` và `staff` vào được CMS.

**3. Bật xác thực**:
- `backend/.env`: `AUTH_ENABLED=true`, `KEYCLOAK_URL=http://localhost:8080`, `KEYCLOAK_REALM=hfarm`
  (thiếu hai biến Keycloak thì backend không khởi động). Khởi động lại backend.
- `KEYCLOAK_ISSUERS` (không bắt buộc): danh sách issuer được chấp nhận, cách nhau dấu phẩy. Cần khi web (`localhost`) và điện thoại (IP LAN)
  cùng dùng một realm, vì Keycloak ghi vào token đúng địa chỉ client dùng để lấy token. Ví dụ
  `KEYCLOAK_ISSUERS=http://localhost:8080/realms/hfarm,http://192.168.1.18:8080/realms/hfarm`. Để trống = chỉ issuer mặc định
  (`KEYCLOAK_URL` + realm). Chữ ký vẫn luôn được kiểm tra bằng JWKS lấy từ `KEYCLOAK_URL`.
- `CORS_ORIGIN` (không bắt buộc): các origin được gọi API, cách nhau dấu phẩy. Bỏ trống khi bật xác thực = chỉ `http://localhost:5173`.
- `web/.env`: `VITE_KEYCLOAK_URL=http://localhost:8080`, `VITE_KEYCLOAK_REALM=hfarm`, `VITE_KEYCLOAK_CLIENT_ID=hfarm-web`
  (đã có sẵn trong `web/.env.example`). Sửa `.env` xong phải khởi động lại `npm run dev`.
- Mở http://localhost:5173: chưa đăng nhập sẽ được chuyển sang trang đăng nhập Keycloak. Token do keycloak-js giữ trong bộ nhớ,
  web không lưu vào localStorage và tự làm mới token trước mỗi request.

**Phân quyền** (backend kiểm tra bằng `requireRole`, giao diện chỉ ẩn thêm cho gọn):

| Chức năng | admin | staff |
|---|---|---|
| Tổng quan, Đơn hàng, Sản phẩm, Kho, tải ảnh | có | có |
| Xem danh mục, thương hiệu, size, màu (form sản phẩm cần) | có | có |
| Thêm/sửa/xóa danh mục, thương hiệu, size, màu | có | 403 |
| Khách hàng (xem, khóa/mở), Mã giảm giá | có | 403 |

Mã lỗi: thiếu hoặc sai token = `401`; đủ token nhưng không đủ quyền hoặc tài khoản bị khóa = `403`;
backend không hỏi được Keycloak = `503`. App mobile đăng nhập Keycloak bằng client riêng `hfarm-mobile` khi đặt `EXPO_PUBLIC_AUTH_MODE=keycloak`
(xem `mobile/README.md`); ở chế độ `dev` mobile cần `AUTH_ENABLED=false`. App native không bị ràng buộc bởi CORS.

## 4. Mobile khách hàng (Expo)
Xem `mobile/README.md` (cần Node >= 22.13).

## Các nhóm API
- Công khai:  GET /api/products, /api/products/:id, /api/categories, /api/brands, /api/sizes, /api/colors
  - `GET /api/products` lọc + sắp xếp + phân trang. Tham số (đều tùy chọn): `q` (tìm theo tên), `category_id`,
    `brand_id` / `size_id` / `color_id` (một hoặc nhiều id cách nhau dấu phẩy, ví dụ `size_id=2,3`),
    `min_price` / `max_price` (tính theo giá thấp nhất của các biến thể đang bán, gồm cả biên),
    `in_stock=1` (chỉ sản phẩm còn hàng), `sort=newest` (mặc định) | `price_asc` | `price_desc` | `bestseller` (bán chạy, bỏ đơn hủy/hoàn trả),
    `page`, `limit`. `size_id`, `color_id` và `in_stock` phải cùng khớp MỘT biến thể đang bán (chọn size M + màu đen + còn hàng = có biến thể M/đen còn hàng).
    Giá trị sai (id không phải số, giá âm, `sort` lạ...) trả 400 kèm thông báo tiếng Việt. CMS (`/api/admin/products`) dùng chung các tham số này.
- Khách hàng (cần đăng nhập): /api/me, /api/me/addresses, /api/cart, /api/orders
  - `POST /api/orders/quote`: body `{ "items": [{ "variant_id": 1, "quantity": 2 }], "coupon_code": "SALE10" }` (cả hai tùy chọn; bỏ `items` = lấy từ giỏ). Trả `{ subtotal, discount_amount, shipping_fee, total_amount }`, dùng chung hàm tính với `POST /api/orders` nên luôn khớp; không ghi DB và không kiểm tra tồn kho. Lỗi (mã sai/hết hạn, đơn tối thiểu, giỏ trống...) trả 400 kèm thông báo tiếng Việt.
  - `POST /api/orders` trả thêm `order_code`.
  - `GET /api/orders?status=&page=&limit=`: đơn của chính người đăng nhập, mới nhất trước. `status` là một trạng thái hoặc nhiều trạng thái cách nhau dấu phẩy (`PENDING`, `CONFIRMED,PROCESSING,SHIPPING`...); giá trị lạ trả 400. Mỗi đơn có thêm `item_count` (số dòng hàng) và `first_product_name`.
  - `GET /api/orders/:id` (chi tiết + lịch sử + thanh toán + vận chuyển) và `POST /api/orders/:id/cancel` (chỉ đơn `PENDING`, hoàn kho).
- CMS (admin/staff): /api/admin/products, /inventory, /orders, /categories, /brands, /sizes, /colors, /users, /coupons, /stats (xem bảng phân quyền ở mục Keycloak)

### API CMS bổ sung
- `GET /api/admin/me`: người đang đăng nhập (admin hoặc staff), trả `{ id, email, full_name, roles }` (`roles` chỉ gồm `admin`/`staff`/`customer`).
- `POST /api/admin/upload`: multipart/form-data, field `file`; chỉ nhận JPG/PNG/WebP tối đa 5 MB, trả `{ "url": "..." }`. URL dùng `PUBLIC_URL`.
- `GET /api/admin/stats/revenue?days=30`: doanh thu và số đơn COMPLETED theo từng ngày (bao gồm ngày không có đơn); `days` từ 1 đến 365.
- `GET /api/admin/stats`: ngoài các chỉ số hiện có, trả thêm `top_products` (5 sản phẩm có tổng số lượng bán cao nhất, bỏ đơn hủy/hoàn trả).
- `POST /api/admin/products/:id/variants/bulk`: tạo nhiều biến thể trong một transaction, body `{ "variants": [{ "size_id": 1, "color_id": 1, "sku": "...", "price": 100000, "quantity": 5 }] }` (tối đa 100 biến thể).
- `GET /api/admin/users/:id/orders?page=1&limit=10`: lịch sử đơn hàng và các dòng sản phẩm của khách hàng, có phân trang.
