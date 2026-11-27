# HFarm - Hệ thống quản lý cửa hàng quần áo

```
HFarm/
├── database/   schema.sql (tạo bảng, size, màu, danh mục)
├── backend/    Node.js + Express + MySQL   -> http://localhost:3000
├── web/        React + Vite + Ant Design   -> http://localhost:5173
├── mobile/     Expo (React Native), app khách hàng
└── docker-compose.yml   chạy cả MySQL + backend + web chỉ bằng một lệnh (xem mục 5)
```

## 1. Database (làm 1 lần)
Mở MySQL Workbench (hoặc phpMyAdmin), chạy file `database/schema.sql` (tự tạo database `clothing_store`, bảng, size, màu, danh mục).
Database mới chưa có sản phẩm: nhập qua web CMS (mục Sản phẩm).

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

**4. Đăng nhập + đăng ký ngay trong app mobile** (không nhảy sang trang Keycloak; làm một lần):
App có form email + mật khẩu riêng. Đăng nhập gửi thẳng tới token endpoint của Keycloak (OAuth password grant); đăng ký đi qua
`POST /api/auth/register` của backend, backend dùng tài khoản dịch vụ của client `hfarm-backend` để tạo người dùng (role `customer`).
Cấu hình tự động bằng script (cần tên + mật khẩu quản trị Keycloak, Keycloak đang chạy):
```
cd backend
npm run setup:keycloak -- --write-env
```
Script hỏi tên và mật khẩu quản trị (mật khẩu không hiện khi gõ, không lưu), rồi: bật "Direct access grants" cho client `hfarm-mobile`, đảm bảo role `customer`,
tạo client `hfarm-backend` (có tài khoản dịch vụ, chỉ quyền quản lý người dùng + đọc realm) và ghi `KEYCLOAK_ADMIN_CLIENT_ID`, `KEYCLOAK_ADMIN_CLIENT_SECRET`
vào `backend/.env` (bỏ `--write-env` thì chỉ in ra màn hình). Chạy lại nhiều lần an toàn. Sau đó khởi động lại backend.
- Chưa chạy script (hoặc thiếu hai biến trên): `GET /api/auth/config` trả `registration: false`, app tự dùng trang đăng ký của Keycloak trong trình duyệt như trước.
- `POST /api/auth/register` body `{ "email", "password", "full_name" }`: kiểm tra dữ liệu (email hợp lệ, mật khẩu 8-128 ký tự, họ tên không có ký tự Keycloak cấm như `< > & " ( )`), giới hạn
  10 lần / 15 phút / IP (đổi bằng `REGISTER_RATE_LIMIT_MAX`, `REGISTER_RATE_LIMIT_WINDOW_MS`; sau reverse proxy phải đặt `app.set('trust proxy', ...)`). Trả 201, 400 (dữ liệu sai hoặc mật khẩu
  chưa đạt chính sách của realm), 409 (email đã đăng ký), 429, 503 (chưa cấu hình / không tới được Keycloak; chi tiết kỹ thuật chỉ ghi vào log backend).
- Mật khẩu không bao giờ nằm trên địa chỉ yêu cầu hay log. Tài khoản tạo từ app có `emailVerified=false`: realm bật bắt buộc xác minh email thì đăng nhập sau đăng ký sẽ báo cần xác minh (app chuyển sang tab Đăng nhập kèm thông báo).
- "Quên mật khẩu?" trong app mở trang đăng nhập của Keycloak (cần bật Forgot password và cấu hình email của realm); CMS (nhân viên) vẫn đăng nhập qua trang Keycloak.
- Đã xóa tài khoản ở Keycloak rồi đăng ký lại bằng đúng email cũ: backend báo 409 "Email đã được dùng bởi một tài khoản khác" vì dòng cũ trong bảng `users` vẫn giữ email đó (xóa hoặc đổi email dòng cũ).

**5. (Tùy chọn) Giao diện đăng nhập mang thương hiệu HFarm**: theme nằm ở `keycloak/themes/hfarm`. Chép vào container
(`docker cp "keycloak\themes\hfarm" keycloak-hfarm:/opt/keycloak/themes/`), rồi trong trang quản trị Keycloak: realm `hfarm` →
Realm settings → Themes → **Login theme = `hfarm`**; muốn chữ tiếng Việt thì Localization → Internationalization On, Default locale = Tiếng Việt.
Chi tiết, cách sửa và quay lại giao diện cũ: `docs/RUNBOOK.md` mục 2.

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
Xem `mobile/README.md` (cần Node >= 22.13). Có tìm kiếm với gợi ý + lịch sử (lưu bằng AsyncStorage, có sẵn trong Expo Go; sau `npm install` hãy chạy lại `npx expo start`).

## 5. Chạy bằng Docker (tùy chọn)
Cài Docker Desktop rồi ở thư mục gốc chạy:
```
docker compose up -d --build
```
- CMS: http://localhost:8088 · API: http://localhost:3100 (thử http://localhost:3100/api/products) · MySQL trong Docker: cổng 3307.
- **MySQL chạy riêng trong container** (volume `hfarm-db`), không dùng MySQL cài trên máy bạn, nên database `clothing_store` của bạn không bị đụng tới
  và ngược lại. Lần đầu, database trống được nạp từ `database/schema.sql`; sau đó dữ liệu và ảnh tải lên được giữ trong volume (`hfarm-db`, `hfarm-uploads`)
  qua các lần `docker compose down` / `up`. Bản chạy `npm run dev` bình thường vẫn dùng MySQL của máy qua `backend/.env`, hai bên độc lập.
- Mặc định là **chế độ dev** (không cần Keycloak): chỉ để chạy thử trên máy mình, vì ai gọi được API cũng có quyền admin. Dùng Keycloak: sao chép `.env.example` thành `.env`,
  đặt `AUTH_ENABLED=true`, `VITE_AUTH_DISABLED=false` và điền các biến Keycloak (backend trong container cần địa chỉ Keycloak mà container với tới được, ví dụ `http://host.docker.internal:8080`).
- Đổi cổng, mật khẩu MySQL hoặc `PUBLIC_URL`: sửa `.env` (bản mẫu: `.env.example`). Đổi `PUBLIC_URL` hoặc biến `VITE_*` thì chạy lại `docker compose up -d --build`.
  Điện thoại cùng Wi-Fi thì đặt `PUBLIC_URL=http://<IP-máy>:3100` và trỏ `EXPO_PUBLIC_API_URL` của app mobile vào `http://<IP-máy>:3100/api`.
- Sửa mã nguồn xong: `docker compose up -d --build`. Xem log: `docker compose logs -f backend`. Xóa sạch dữ liệu Docker để bắt đầu lại: `docker compose down -v` (không ảnh hưởng MySQL trên máy).
- Mang dữ liệu từ MySQL của máy sang Docker (lệnh thông dụng, chưa thử trên dữ liệu thật của bạn): `mysqldump -u root -p clothing_store > clothing_store.sql` rồi
  `docker compose exec -T db mysql -uroot -p<mật-khẩu-DB_PASSWORD> clothing_store < clothing_store.sql`.

## Các nhóm API
- Công khai:  GET /api/products, /api/products/:id, /api/categories, /api/brands, /api/sizes, /api/colors, /api/banners, /api/payments/methods, /api/shipping/estimate, /api/tracking/:mã-vận-đơn, /api/store (thông tin liên hệ + số ngày đổi trả, đọc từ `STORE_*` và `RETURN_DAYS` trong `backend/.env`), GET /api/groups/:mã (xem nhóm mua nhóm), trang mời /g/:mã, GET /api/stylist/options, POST /api/stylist/outfits (Stylist gợi ý bộ đồ theo chiều cao, cân nặng, phong cách, hoàn cảnh, ngân sách), GET /api/gifts/options, POST /api/gifts/suggestions (Quà tặng: gợi ý quà theo dịp, size, ngân sách)
  - Từ 2026-11-24: `GET /api/products?on_sale=1` (chỉ sản phẩm đang giảm giá); `GET /api/categories` kèm `thumbnail`; `GET /api/banners` (banner trang chủ app); `GET /api/payments/methods` (COD, và chuyển khoản nếu đã cấu hình `BANK_*`); `GET /api/shipping/estimate?province=&subtotal=` (phí + số ngày giao theo vùng); `GET /api/tracking/:code` (tra cứu hành trình, tên người nhận được che, không lộ SĐT/địa chỉ). Chi tiết: `docs/API.md`.
  - Từ 2026-11-26 (**Stylist**): `POST /api/stylist/outfits` trả tối đa 3 bộ đồ (áo + quần, thêm giày, phụ kiện, áo khoác nếu còn ngân sách) từ sản phẩm đang bán, còn hàng, đúng size, **tổng không vượt ngân sách**; chạy trên server bằng bộ máy chấm điểm (không phải mô hình ngôn ngữ, không gọi dịch vụ ngoài, không lưu số đo). Cần chạy `database/migrations/003_outfit_stylist.sql` (thêm 4 cột `gender`, `outfit_role`, `styles`, `occasions` vào `products`; backend không khởi động nếu thiếu) và gắn thẻ sản phẩm trong CMS thì mới có gì để phối. Kiểm thử: `cd backend && npm test`.
  - Từ 2026-11-26 (**Mua nhóm**): sản phẩm có bậc giá "đủ N người thì mỗi người giảm X%" (cấu hình ở CMS); khách tạo nhóm, gửi mã / link mời (`/g/<mã>`), hết hạn hoặc đủ người thì nhóm chốt, thành viên mua với giá nhóm (tự áp ở báo giá và đặt hàng, trường `group_discount`). Không thu tiền lúc tham gia. API: `POST /api/groups`, `GET /api/groups/mine`, `GET /api/groups/:code`, `POST /api/groups/:code/join|leave|cancel`, `PUT /api/groups/:code/variant`; CMS: `GET/PUT /api/admin/products/:id/group-buy`, `GET /api/admin/groups`. Cần chạy `database/migrations/004_group_buy.sql` (backend không khởi động nếu thiếu). Chi tiết: `docs/API.md` mục 2.5, 3.9.
  - Từ 2026-11-27 (**Quà tặng**): người thân chọn quà cho một bạn nam theo dịp + size + ngân sách (`POST /api/gifts/suggestions`: quà chính, combo, quà nhỏ; giày chỉ gợi ý khi biết chắc size giày), chọn mẫu thiệp + viết lời nhắn (`GET /api/gifts/options`), rồi đặt **đơn quà** từ giỏ bằng `POST /api/gifts/checkout` (cần đăng nhập; **chỉ chuyển khoản**, COD bị chặn; ghi thiệp vào `order_gifts`, phiếu giao hàng in từ CMS không ghi giá, có nút In thiệp). Cần chạy `database/migrations/005_gift_orders.sql` (backend không khởi động nếu thiếu); gói quà là một sản phẩm thường trỏ bằng `GIFT_WRAP_SKU` trong `backend/.env`. Chi tiết: `docs/API.md` mục 2.6, `docs/RUNBOOK.md` mục 8.3.
  - `GET /api/products` lọc + sắp xếp + phân trang. Tham số (đều tùy chọn): `q` (tìm theo tên), `category_id`,
    `brand_id` / `size_id` / `color_id` (một hoặc nhiều id cách nhau dấu phẩy, ví dụ `size_id=2,3`),
    `min_price` / `max_price` (tính theo giá thấp nhất của các mẫu mã đang bán, gồm cả biên),
    `in_stock=1` (chỉ sản phẩm còn hàng), `sort=newest` (mặc định) | `price_asc` | `price_desc` | `bestseller` (bán chạy, bỏ đơn hủy/hoàn trả),
    `page`, `limit`. `size_id`, `color_id` và `in_stock` phải cùng khớp MỘT mẫu mã đang bán (chọn size M + màu đen + còn hàng = có mẫu mã M/đen còn hàng).
    Giá trị sai (id không phải số, giá âm, `sort` lạ...) trả 400 kèm thông báo tiếng Việt. CMS (`/api/admin/products`) dùng chung các tham số này.
    Mỗi sản phẩm trong danh sách có thêm `compare_at_price` (giá gốc của mẫu mã rẻ nhất, để hiện giá gạch), `rating_avg`, `rating_count`; chi tiết có `rating_avg`, `rating_count`, `sold_count`
    và các mẫu mã xếp size chữ trước size số.
  - `GET /api/products/suggest?q=ao&limit=8`: gợi ý khi gõ ô tìm kiếm, `[{ id, name, price, thumbnail }]` (sản phẩm đang bán). Không phân biệt hoa/thường và dấu; xếp: tên bắt đầu bằng chữ gõ,
    rồi đầu một từ, rồi chứa ở giữa. `limit` tối đa 20; để trống `q` trả `[]`.
  - `GET /api/products/:id/related?limit=8`: sản phẩm liên quan (cùng danh mục, còn hàng / cùng thương hiệu / giá gần trước; thiếu thì bổ sung sản phẩm bán chạy).
  - `GET /api/products/:id/reviews?page=1&limit=5`: đánh giá đã duyệt `{ summary: { count, average, distribution: { 1..5 } }, data: [{ id, rating, comment, created_at, reviewer_name }], page, limit, total }`;
    `reviewer_name` được che (ví dụ "Nguyễn V. A.").
- Khách hàng (cần đăng nhập): /api/me, /api/me/addresses, /api/cart, /api/orders, /api/favorites, /api/reviews
  - Yêu thích: `GET /api/favorites/ids` (mảng id, mới thích trước), `GET /api/favorites?page=&limit=` (sản phẩm đang bán đã thích), `PUT /api/favorites/:productId` (thích, lặp lại vẫn một dòng), `DELETE /api/favorites/:productId`.
  - Đánh giá: `POST /api/reviews` body `{ "order_item_id": 12, "rating": 5, "comment": "..." }` (nhận xét tối đa 1000 ký tự). Chỉ đánh giá được món trong đơn **Hoàn thành** của chính mình, mỗi món một lần
    (trùng trả 409); trạng thái đầu là `PENDING`, nhân viên duyệt ở CMS thì mới hiện công khai. `GET /api/orders/:id` có thêm `product_id`, `review_id`, `review_rating`, `review_status` cho mỗi dòng hàng.
  - `POST /api/orders/quote`: body `{ "items": [{ "variant_id": 1, "quantity": 2 }], "coupon_code": "SALE10" }` (cả hai tùy chọn; bỏ `items` = lấy từ giỏ). Trả `{ subtotal, discount_amount, shipping_fee, total_amount }`, dùng chung hàm tính với `POST /api/orders` nên luôn khớp; không ghi DB và không kiểm tra tồn kho. Lỗi (mã sai/hết hạn, đơn tối thiểu, giỏ trống...) trả 400 kèm thông báo tiếng Việt.
  - `POST /api/orders` trả thêm `order_code`.
  - `GET /api/orders?status=&page=&limit=`: đơn của chính người đăng nhập, mới nhất trước. `status` là một trạng thái hoặc nhiều trạng thái cách nhau dấu phẩy (`PENDING`, `CONFIRMED,PROCESSING,SHIPPING`...); giá trị lạ trả 400. Mỗi đơn có thêm `item_count` (số dòng hàng) và `first_product_name`.
  - `GET /api/orders/:id` (chi tiết + lịch sử + thanh toán + vận chuyển) và `POST /api/orders/:id/cancel` (chỉ đơn `PENDING`, hoàn kho và hoàn lượt mã giảm giá).
  - `POST /api/orders/quote` nhận thêm `address_id` (phí ship theo vùng của tỉnh trong địa chỉ) và trả thêm `shipping_zone { zone_name, eta_min_days, eta_max_days, free_over }`.
  - `GET /api/orders/:id/payment`: thông tin chuyển khoản của đơn `BANK_TRANSFER` kèm ảnh mã VietQR (`qr_image`, data URL) đúng số tiền + nội dung, `seconds_left` (hạn trả), `payable`. `GET /api/orders/:id/tracking`: hành trình giao hàng (mới nhất trước).
  - Thanh toán chuyển khoản: bật bằng `BANK_BIN`, `BANK_ACCOUNT_NO`, `BANK_ACCOUNT_NAME` trong `backend/.env`; đơn quá `PAYMENT_HOLD_MINUTES` (mặc định 24 giờ) chưa trả tự hủy + hoàn kho; webhook `POST /api/payments/webhook/sepay` (khóa `PAYMENT_WEBHOOK_KEY`) tự đánh dấu đã trả. Hướng dẫn: `docs/RUNBOOK.md` mục 8 và 9.
- CMS (admin/staff): /api/admin/products, /inventory, /orders, /reviews, /categories, /brands, /sizes, /colors, /users, /coupons, /stats, /shipping-zones, /bank-transactions, /banners (xem bảng phân quyền ở mục Keycloak và `docs/ARCHITECTURE.md` mục 3.6)

### API CMS bổ sung
- **Database: áp dụng migration trước khi chạy backend mới** (`database/migrations/001_payment_shipping.sql`, `002_banners.sql`; chạy đúng một lần, cách làm: `docs/RUNBOOK.md` mục 8). Thiếu thì backend dừng ngay và nói rõ file nào.
- `POST /api/admin/orders/:id/confirm-payment` (xác nhận đã nhận tiền chuyển khoản), `POST /api/admin/orders/:id/shipment-events` + `DELETE .../:eventId` (ghi/xóa mốc hành trình khi đơn đang giao), `GET/POST/PUT/DELETE /api/admin/shipping-zones` (phí ship theo vùng; chỉ admin ghi), `GET /api/admin/bank-transactions` + `PATCH .../:id/resolve` (giao dịch ngân hàng cần xử lý), `GET/POST/PUT/DELETE /api/admin/banners` (chỉ admin). `POST/PUT /api/admin/products` nhận thêm thẻ Stylist `outfit_role`, `styles[]`, `occasions[]` (xem `docs/API.md` mục 3.2).
- `GET /api/admin/me`: người đang đăng nhập (admin hoặc staff), trả `{ id, email, full_name, roles }` (`roles` chỉ gồm `admin`/`staff`/`customer`).
- `POST /api/admin/upload`: multipart/form-data, field `file`; chỉ nhận JPG/PNG/WebP tối đa 5 MB, trả `{ "url": "..." }`. URL dùng `PUBLIC_URL`.
- `GET /api/admin/stats/revenue?days=30`: doanh thu và số đơn COMPLETED theo từng ngày (bao gồm ngày không có đơn); `days` từ 1 đến 365.
- `GET /api/admin/stats`: ngoài các chỉ số hiện có, trả thêm `top_products` (5 sản phẩm có tổng số lượng bán cao nhất, bỏ đơn hủy/hoàn trả).
- `POST /api/admin/products/:id/variants/bulk`: tạo nhiều mẫu mã trong một transaction, body `{ "variants": [{ "size_id": 1, "color_id": 1, "sku": "...", "price": 100000, "quantity": 5 }] }` (tối đa 100 mẫu mã).
- `GET /api/admin/users?type=CUSTOMER&status=ACTIVE|INACTIVE|BLOCKED&q=&page=&limit=`: danh sách người dùng kèm số đơn và tổng chi tiêu; `status` sai trả 400 ("Trạng thái tài khoản không hợp lệ").
- `GET /api/admin/users/:id/orders?page=1&limit=10`: lịch sử đơn hàng và các dòng sản phẩm của khách hàng, có phân trang.
- `GET /api/admin/orders`: `status` nhận một hoặc nhiều trạng thái cách nhau dấu phẩy (`CONFIRMED,PROCESSING`), thêm `payment_status` (`UNPAID`/`PAID`...) và `q` (tìm theo mã đơn, tên, SĐT hoặc mã vận đơn). Mỗi dòng có thêm `payment_method`, `carrier`, `tracking_code`. Giá trị sai trả 400.
- `GET /api/admin/orders/counts`: số đơn theo từng trạng thái, `{ "PENDING": 3, "CONFIRMED": 0, ... }` (đủ 7 trạng thái), dùng cho các tab của trang Đơn hàng.
- `POST /api/admin/orders/bulk`: xử lý một hoặc nhiều đơn theo "bước tiếp theo", body `{ "ids": [1, 2], "action": "confirm", "note": "...", "carrier": "...", "tracking_code": "..." }` (tối đa 100 đơn).
  `action`: `confirm` (Chờ xác nhận → Đã xác nhận), `ship` (Đã xác nhận/Đang xử lý → Đang giao; từ Đã xác nhận tự đi qua Đang xử lý), `complete` (Đang giao → Hoàn thành),
  `cancel` (→ Đã hủy, hoàn kho), `return` (Đang giao/Hoàn thành → Hoàn trả, hoàn kho). Đơn nào không hợp lệ chỉ báo lỗi riêng trong `results`, các đơn còn lại vẫn được xử lý;
  trả `{ results: [{ id, order_code, ok, status, tracking_code?, error? }], succeeded, failed }`. `tracking_code` chỉ nhận khi xử lý một đơn.
- `GET /api/admin/reviews?status=PENDING|APPROVED|REJECTED&rating=&q=&page=&limit=`: danh sách đánh giá kèm sản phẩm, người đánh giá, mã đơn. `GET /api/admin/reviews/counts` trả `{ PENDING, APPROVED, REJECTED }`.
  `POST /api/admin/reviews/bulk-status` body `{ "ids": [1, 2], "status": "APPROVED" }` (tối đa 100; `REJECTED` = ẩn khỏi cửa hàng), `DELETE /api/admin/reviews/:id`. Cả admin và staff dùng được.
- **Mã vận đơn tự sinh**: khi chuyển sang Đang giao mà không nhập mã, hệ thống tạo mã duy nhất dạng `HF` + ngày (yyMMdd) + 6 ký tự, ví dụ `HF261118K7M2QP`, và dùng đơn vị vận chuyển mặc định `HFarm Express` (đổi bằng `DEFAULT_CARRIER` trong `backend/.env`). Vẫn nhập tay được; mã nhập tay trùng đơn khác bị từ chối.
- Công khai: `GET /api/sizes` trả thêm `size_group` (`LETTER` cho XS…XXL/2XL, `NUMBER` cho 28, 30, 38.5…, `OTHER` cho Free size…) và sắp xếp chữ → số → khác (suy ra từ tên size, không cần sửa database).
  `GET /api/sizes`, `/colors`, `/brands` nhận `?in_use=1` để chỉ trả mục đang có sản phẩm đang bán (bảng lọc ở mobile dùng).
