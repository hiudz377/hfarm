# API HFarm (backend Express)

> Lập từ `backend/index.js` và `backend/src/routes/**` ngày 2026-11-18, cập nhật 2026-11-24 (thanh toán VietQR, giao hàng theo vùng, banner). Đường dẫn dưới đây gồm tiền tố `/api` trừ khi ghi khác.
> Địa chỉ: dev `http://localhost:3000`, Docker `http://localhost:3100` (xem [RUNBOOK.md](RUNBOOK.md)).

## Quy ước chung
- Gửi/nhận JSON (`Content-Type: application/json`), trừ `POST /api/admin/upload` (multipart).
- Cần đăng nhập = header `Authorization: Bearer <access_token>` (Keycloak). Chế độ dev (`AUTH_ENABLED=false`): không cần token, chọn vai trò bằng header `X-Dev-Role: admin|staff|customer` (xem [ARCHITECTURE.md](ARCHITECTURE.md) mục 3).
- Phân trang: `page` (mặc định 1), `limit` (mặc định 10, tối đa 100).
- Lỗi: `{ "error": "<thông báo tiếng Việt>" }`. Mã chung: 400 dữ liệu sai, 401 chưa đăng nhập/token sai, 403 không đủ quyền hoặc tài khoản bị khóa, 404 không thấy, 409 trùng/xung đột, 413 tệp quá lớn, 429 quá nhiều yêu cầu, 500 `Lỗi server`, 503 Keycloak/đăng ký trong app chưa sẵn sàng.
- Lỗi database được đổi thống nhất (`backend/index.js`): trùng khóa -> 409 `Dữ liệu bị trùng (ví dụ SKU, tên, mã)`; xóa dòng đang được tham chiếu -> 409 `Đang được sử dụng ở nơi khác nên không thể xóa. Hãy chuyển sang ngừng hoạt động`; khóa ngoại sai -> 400 `Dữ liệu liên kết không tồn tại (danh mục, size, màu...)`; vi phạm CHECK -> 400 `Giá trị không hợp lệ (ví dụ giá âm)`. Đường dẫn lạ -> 404 `Không tìm thấy đường dẫn`.
- Tiền là số (VND, DECIMAL trả ra dạng số).
- Giải thích cột **Role**: `-` = không cần đăng nhập; `mọi role` = đã đăng nhập, backend không chặn theo role (chỉ thấy dữ liệu của chính mình); `admin, staff` / `admin` = `requireRole`.

## 1. Công khai (không cần đăng nhập)

| Method | Path | Mô tả | Tham số / body chính |
|---|---|---|---|
| GET | `/` (không có `/api`) | Kiểm tra sống: `{ message: "Server HFarm đang chạy!" }` | - |
| GET | `/uploads/<tên-tệp>` (không có `/api`) | Ảnh đã tải lên (tĩnh) | - |
| GET | `/api/categories` | Danh mục đang hoạt động, mỗi mục kèm `thumbnail` (ảnh chính của sản phẩm đang bán mới nhất trong danh mục, `null` nếu chưa có) | - |
| GET | `/api/brands` | Thương hiệu đang hoạt động | `in_use=1`: chỉ thương hiệu có sản phẩm ĐANG BÁN |
| GET | `/api/sizes` | Size, thêm `size_group` (`LETTER`/`NUMBER`/`OTHER`), xếp chữ -> số -> khác | `in_use=1`: chỉ size có mẫu mã đang bán |
| GET | `/api/colors` | Màu (`id, name, hex_code`) | `in_use=1` như trên |
| GET | `/api/products` | Sản phẩm ĐANG BÁN, lọc + sắp xếp + phân trang. Trả `{ data, page, limit, total }`; mỗi dòng có `min_price, compare_at_price, group_max_percent` (mức giảm mua nhóm cao nhất, `null` nếu không mở mua nhóm), `total_stock, thumbnail, rating_avg, rating_count, category_name, brand_name` | `q` (tên), `category_id`, `brand_id`/`size_id`/`color_id` (một hoặc nhiều id cách nhau dấu phẩy), `min_price`, `max_price` (theo giá thấp nhất của mẫu mã đang bán, gồm biên), `in_stock=1`, `on_sale=1` (chỉ sản phẩm có mẫu mã đang bán với `compare_at_price` > `price`), `sort=newest`(mặc định)`\|price_asc\|price_desc\|bestseller`, `page`, `limit`. `size_id`, `color_id`, `in_stock` phải cùng khớp MỘT mẫu mã đang bán |
| GET | `/api/products/suggest` | Gợi ý khi gõ tìm kiếm: `[{ id, name, price, thumbnail }]`, không phân biệt hoa/thường và dấu; `q` trống -> `[]` | `q` (tối đa 60 ký tự), `limit` (mặc định 8, tối đa 20) |
| GET | `/api/products/:id` | Chi tiết: thông tin, `variants` (kèm `size_name, color_name, hex_code, stock`; size chữ trước số), `images`, `rating_avg`, `rating_count`, `sold_count`, thẻ Stylist (`outfit_role`, `styles[]`, `occasions[]`), `group_buy` (`{ hours, tiers: [{ min_members, discount_percent }] }` khi sản phẩm đang mở mua nhóm, không thì `null`; CMS luôn thấy cấu hình đầy đủ kể cả khi tắt). Chỉ sản phẩm ACTIVE và mẫu mã đang bán | - |
| GET | `/api/products/:id/related` | Sản phẩm liên quan (cùng danh mục, còn hàng/cùng thương hiệu/giá gần trước; thiếu thì bổ sung bán chạy) | `limit` (mặc định 8, tối đa 24) |
| GET | `/api/products/:id/reviews` | Đánh giá ĐÃ DUYỆT: `{ summary: { count, average, distribution{1..5} }, data: [{ id, rating, comment, created_at, reviewer_name }], page, limit, total }`; `reviewer_name` được che ("Nguyễn V. A.") | `page`, `limit` |
| GET | `/api/banners` | Banner trang chủ app đang bật và trong thời gian hiển thị, theo thứ tự: `[{ id, title, subtitle, image_url, link_type: NONE\|CATEGORY\|PRODUCT\|COLLECTION, link_value }]` (`COLLECTION`: `new\|bestseller\|sale`). Rỗng thì app hiện banner mặc định | - |
| GET | `/api/payments/methods` | Phương thức thanh toán đang bật: `{ methods: [{ value: "COD" }, { value: "BANK_TRANSFER", hold_minutes, auto_confirm }] }`. `BANK_TRANSFER` chỉ có khi đã đặt `BANK_*` trong `.env`; `auto_confirm` = webhook ngân hàng đã bật | - |
| GET | `/api/store` | Thông tin cửa hàng cho app (màn Liên hệ, nút "Liên hệ cửa hàng" ở đơn hàng, chính sách đổi trả): `{ name, phone, zalo, email, address, hours, return_days }`. Đọc từ `STORE_NAME`, `STORE_PHONE`, `STORE_ZALO`, `STORE_EMAIL`, `STORE_ADDRESS`, `STORE_HOURS`, `RETURN_DAYS` trong `backend/.env` (không đụng database, đọc mỗi lần gọi). Trường chưa đặt hoặc sai định dạng (số điện thoại không phải 8-15 chữ số, email sai) là `null`; `name` mặc định `HFarm`; `return_days` mặc định 7 (hợp lệ 1 - 90) | - |
| POST | `/api/payments/webhook/sepay` | Webhook ngân hàng (SePay) báo tiền vào. Xem mục 5. 200 `{ success: true, result }` | header `Authorization: Apikey <PAYMENT_WEBHOOK_KEY>`; body SePay (`id, transferType, transferAmount, content, code, accountNumber, transactionDate`). 401 sai khóa, 503 chưa đặt khóa. Giới hạn 120 lần/phút/IP |
| GET | `/api/shipping/estimate` | Phí + thời gian giao theo vùng: `{ zone_id, zone_name, fee, base_fee, free_over, eta_min_days, eta_max_days }` | `province` (bỏ trống = vùng mặc định), `subtotal` (để tính miễn phí); 400 `Cửa hàng chưa hỗ trợ giao hàng đến khu vực này` |
| GET | `/api/tracking/:code` | Tra cứu hành trình theo mã vận đơn (không cần đăng nhập): `{ tracking_code, carrier, shipment_status, order_status, shipped_at, delivered_at, recipient (đã che: "N*** An"), province, timeline: [{ id, at, kind, status?, title, location? }] }`. KHÔNG trả SĐT, địa chỉ chi tiết, sản phẩm, tiền. 404 `Không tìm thấy mã vận đơn`. Giới hạn 30 lần/phút/IP | - |
| GET | `/api/auth/config` | `{ registration: boolean }`: backend đã cấu hình để đăng ký ngay trong app chưa | - |
| POST | `/api/auth/register` | Tạo tài khoản khách ở Keycloak (role `customer`) rồi app tự đăng nhập. 201 `{ ok: true }` | body `{ email, password (8-128 ký tự), full_name (<= 150, không có ký tự `< > & " ( ) ; * = ?`...) }`. Giới hạn 10 lần/15 phút/IP |
| GET | `/api/stylist/options` | Các lựa chọn của Stylist (nhãn tiếng Việt, một nguồn duy nhất cho app và CMS): `{ roles: [TOP\|BOTTOM\|OUTERWEAR\|SHOES\|ACCESSORY], styles: [MINIMALIST\|CASUAL\|STREETWEAR\|SPORTY\|ELEGANT\|VINTAGE\|KOREAN\|LUXURY\|JAPANESE], occasions: [SCHOOL\|WORK\|HANGOUT\|DATE\|PARTY\|SPORT\|TRAVEL], budget: { min, max }, max_styles }` | - |
| POST | `/api/stylist/outfits` | **Stylist gợi ý bộ đồ** (chỉ đọc, không lưu gì; POST để số đo không nằm trong URL). Chọn tối đa 3 bộ KHÁC NHAU về phần lõi (áo + quần, thêm giày / phụ kiện / áo khoác nếu còn ngân sách) từ sản phẩm ACTIVE đã gắn thẻ, còn hàng, đúng size, **tổng không vượt ngân sách**. 200 `{ profile, size_advice: { letter, shoe, shoe_estimated, too_big }, outfits: [{ key: BEST\|SAVER\|ALT, label, total, remaining, items: [{ role, role_label, product_id, name, brand_name, thumbnail, variant_id, size_name, color_name, hex_code, price, compare_at_price, stock, size_note: EXACT\|NEAR\|null, reasons: [chữ] }], highlights: [chữ], skipped: [{ role, role_label, reason: OVER_BUDGET\|NO_PRODUCT, need_budget? }] }], notes: [chữ] }`. Không ghép được bộ nào thì `outfits: []` kèm `empty_reason`: `BUDGET_TOO_LOW` (+ `min_budget`) hoặc `NO_PRODUCT` (+ `missing_roles`). Mua: app gọi `POST /api/cart/items` từng món (`variant_id`, `quantity: 1`) | body `{ height_cm (120-220), weight_kg (25-150), styles: [1-3 mã] (hoặc style: mã), occasion, budget (100.000-100.000.000) }`; 400 `Chiều cao nên từ 120 đến 220 cm.` / `Cân nặng nên từ 25 đến 150 kg.` / `Hãy chọn từ 1 đến 3 phong cách.` / `Phong cách không hợp lệ: <mã>` / `Hãy chọn hoàn cảnh.` / `Ngân sách nên từ 100.000 đến 100.000.000 ₫.`; 429 `Bạn nhờ gợi ý quá nhanh, vui lòng thử lại sau ít phút.` (30 lượt/phút/IP). Cửa hàng chỉ bán đồ nam nên không có giới tính (trường `gender` gửi thừa bị bỏ qua) |

Lỗi đặc trưng:
- `/products*`: 400 `Giá trị brand_id không hợp lệ` (tương tự `size_id`, `color_id`, `min_price`, `max_price`), 400 `Kiểu sắp xếp không hợp lệ: <sort>`, 404 `Không tìm thấy sản phẩm`.
- `/auth/register`: 400 `Vui lòng nhập họ tên` / `Họ tên tối đa 150 ký tự` / `Họ tên không được chứa ký tự đặc biệt như < > & " ( ) ; * = ?` / `Email không hợp lệ` / `Mật khẩu cần ít nhất 8 ký tự` / `Mật khẩu tối đa 128 ký tự` / `Mật khẩu chưa đạt yêu cầu: <chính sách realm>`; 409 `Email này đã được đăng ký. Hãy đăng nhập.`; 429 `Bạn đã thử đăng ký quá nhiều lần. Vui lòng thử lại sau ít phút.` (kèm header `Retry-After`); 503 `Đăng ký trong ứng dụng chưa được bật. Vui lòng liên hệ cửa hàng.` / `Không kết nối được máy chủ tài khoản. Vui lòng thử lại sau.` / `Đăng ký trong ứng dụng chưa được cấu hình đúng. Vui lòng liên hệ cửa hàng.`

## 2. Khách hàng (cần đăng nhập, Role = mọi role)

Chỉ thao tác trên dữ liệu của chính người đăng nhập.

### 2.1 Hồ sơ và địa chỉ (`/api/me`)
| Method | Path | Mô tả | Tham số / body chính |
|---|---|---|---|
| GET | `/api/me` | `{ id, email, full_name, phone, avatar_url, user_type, created_at, roles }` | - |
| PUT | `/api/me` | Sửa hồ sơ | body: `full_name`, `phone`, `avatar_url` (ít nhất một; không thì 400 `Không có dữ liệu để cập nhật`) |
| GET | `/api/me/addresses` | Sổ địa chỉ (mặc định lên đầu) | - |
| POST | `/api/me/addresses` | Thêm địa chỉ, 201 `{ id }`. Địa chỉ đầu tiên luôn là mặc định | body: `recipient_name, phone, province, district, ward, address_detail` (bắt buộc; thiếu -> 400 `Thiếu <tên_cột>`), `is_default` |
| PUT | `/api/me/addresses/:id` | Sửa địa chỉ; 404 `Không tìm thấy địa chỉ` | các trường như trên (một phần) |
| DELETE | `/api/me/addresses/:id` | Xóa (không báo lỗi nếu không có) | - |

### 2.2 Giỏ hàng (`/api/cart`), mỗi người một giỏ `ACTIVE`
| Method | Path | Mô tả | Tham số / body chính |
|---|---|---|---|
| GET | `/api/cart` | `{ id, items: [{ id, variant_id, quantity, sku, price, product_id, product_name, size_name, color_name, image_url, stock }], subtotal }` | - |
| POST | `/api/cart/items` | Thêm (đã có thì cộng dồn; KHÔNG giới hạn theo tồn kho). 201, trả giỏ mới | body `{ variant_id, quantity (mặc định 1) }`; 400 `Dữ liệu không hợp lệ`; 404 `Sản phẩm không còn bán` |
| PUT | `/api/cart/items/:id` | Đổi số lượng, trả giỏ | body `{ quantity }` (số nguyên >= 1; 400 `Số lượng không hợp lệ`) |
| DELETE | `/api/cart/items/:id` | Xóa dòng, trả giỏ | - |

### 2.3 Đơn hàng (`/api/orders`)
| Method | Path | Mô tả | Tham số / body chính |
|---|---|---|---|
| POST | `/api/orders/quote` | Xem trước tiền `{ subtotal, discount_amount, group_discount, shipping_fee, total_amount, shipping_zone: { zone_name, fee, free_over, eta_min_days, eta_max_days } }`; không ghi DB, không kiểm tra tồn kho. Phí ship theo vùng của tỉnh trong địa chỉ | body `{ items?: [{ variant_id, quantity }], coupon_code?, address_id? \| province? }` (bỏ `items` = lấy từ giỏ; không có địa chỉ = vùng mặc định) |
| POST | `/api/orders` | Đặt hàng (transaction, trừ kho). 201 `{ id, order_code, subtotal, discount_amount, group_discount, shipping_fee, total_amount, shipping_zone }`. `BANK_TRANSFER` đặt `payment_expires_at` (hạn trả) và bị từ chối 400 `Cửa hàng chưa bật thanh toán chuyển khoản` nếu chưa cấu hình ngân hàng | body `{ address_id` hoặc `recipient_name, recipient_phone, province, district, ward, address_detail; items?; payment_method: COD\|BANK_TRANSFER\|ONLINE; coupon_code?; customer_note? }` |
| GET | `/api/orders` | Đơn của mình, mới nhất trước. Trả MẢNG (không có `total`): `{ id, order_code, total_amount, status, payment_status, created_at, item_count, first_product_name }` | `status` (một hoặc nhiều, cách nhau dấu phẩy), `page`, `limit`; sai -> 400 `Trạng thái đơn hàng không hợp lệ: <X>` |
| GET | `/api/orders/:id` | Chi tiết: đơn + `items` (kèm `product_id, review_id, review_rating, review_status`) + `history` + `payment` + `shipment` + `gift` (thiệp / ẩn giá / gói quà nếu là đơn quà tặng, không thì `null`; xem mục 2.6). Đơn của người khác -> 404 | - |
| GET | `/api/orders/:id/payment` | Thông tin chuyển khoản của đơn `BANK_TRANSFER`: `{ order_code, order_status, payment_status, amount, seconds_left, expired, payable, bank: { bank_name, account_no, account_name }, transfer_content, qr_payload, qr_image }`. `qr_image` là ảnh PNG VietQR dạng data URL (đúng số tiền + nội dung = mã đơn). `payable = false` (đã trả/hủy/quá hạn/chưa cấu hình) thì không có `qr_*`. `seconds_left` tính theo đồng hồ MySQL (null = không có hạn). Đơn COD -> 400 `Đơn này không thanh toán bằng chuyển khoản`; đơn người khác -> 404 | - |
| GET | `/api/orders/:id/tracking` | Hành trình đơn, mới nhất trước: `{ order_code, order_status, shipment: { carrier, tracking_code, status, shipped_at, delivered_at } \| null, timeline: [{ id, at, kind: status\|payment\|event, status?, title, note?, location? }] }`. Gộp mốc đổi trạng thái, mốc "đã nhận tiền" và mốc nhân viên ghi | - |
| POST | `/api/orders/:id/cancel` | Hủy (chỉ `PENDING`, hoàn kho). `{ message: "Đã hủy đơn" }` | body `{ note? }`; 400 `Chỉ hủy được đơn đang chờ xác nhận` |

Lỗi đặc trưng khi đặt/báo giá (đều 400): `Giỏ hàng trống`; `Sản phẩm hoặc số lượng không hợp lệ`; `Địa chỉ không tồn tại`; `Thiếu thông tin giao hàng`; `Sản phẩm (mã <N>) không còn bán`; `Mã giảm giá không hợp lệ hoặc đã hết hạn`; `Đơn tối thiểu <số>đ để dùng mã này`; `Mã đã hết lượt dùng`; `Bạn đã dùng hết lượt của mã này`; `Không đủ tồn kho cho <tên (size/màu)> (còn <N>)` (chỉ khi đặt, báo giá không kiểm tra). `payment_method` lạ bị đổi thành `COD`.
Phí ship tính theo VÙNG của tỉnh nhận hàng (bảng `shipping_zones`, chỉnh trong CMS; mặc định 30.000 ₫, miễn phí từ 500.000 ₫). Đơn hủy/hoàn trả được trả lại lượt dùng mã giảm giá. Chi tiết luồng: [ARCHITECTURE.md](ARCHITECTURE.md) mục 4.

### 2.4 Yêu thích và đánh giá
| Method | Path | Mô tả | Tham số / body chính |
|---|---|---|---|
| GET | `/api/favorites/ids` | Mảng `product_id` đã thích, mới nhất trước | - |
| GET | `/api/favorites` | Sản phẩm ĐANG BÁN đã thích: `{ data, page, limit, total }` (dòng như `/products` + `favorited_at`) | `page`, `limit` |
| PUT | `/api/favorites/:productId` | Thích (lặp lại vẫn một dòng): `{ product_id, favorited: true }` | 400 `Mã sản phẩm không hợp lệ`; 404 `Sản phẩm không còn bán` |
| DELETE | `/api/favorites/:productId` | Bỏ thích: `{ product_id, favorited: false }` | - |
| POST | `/api/reviews` | Gửi đánh giá cho một dòng hàng của đơn `COMPLETED` của chính mình; 201 `{ id, status: "PENDING" }` (hiện công khai sau khi nhân viên duyệt) | body `{ order_item_id, rating (1-5), comment? (<= 1000 ký tự) }` |

Lỗi `POST /api/reviews`: 400 `Thiếu sản phẩm cần đánh giá` / `Số sao phải từ 1 đến 5` / `Nhận xét tối đa 1000 ký tự` / `Chỉ đánh giá được sau khi đơn hàng hoàn thành` / `Sản phẩm này không còn để đánh giá`; 404 `Không tìm thấy sản phẩm trong đơn hàng`; 409 `Bạn đã đánh giá sản phẩm này trong đơn hàng này`.

### 2.5 Mua nhóm (`/api/groups`) - khách hàng
Sản phẩm có các bậc giá "đủ N người thì mỗi người giảm X%" (cấu hình ở CMS). Khách tạo nhóm cho **một mẫu mã** (size x màu) rồi gửi mã / link mời; thành viên chọn mẫu mã của mình khi vào. **Không thu tiền lúc tham gia.** Nhóm đủ người ở bậc cao nhất thì chốt ngay; hết hạn (`group_buy_hours`, mặc định 48 giờ) thì chốt ở bậc cao nhất đã đạt: đạt ít nhất một bậc -> `SUCCESS` (mỗi thành viên được giảm theo bậc đó cho ĐÚNG mẫu mã đã chọn, 1 sản phẩm / suất, trong `GROUP_CLAIM_HOURS` giờ, mặc định 24), không đạt bậc nào -> `FAILED` (mua giá thường). Giảm giá được áp TỰ ĐỘNG ở `/orders/quote` và `POST /orders` (trường `group_discount`, tính trước mã giảm giá). Suất chỉ dùng một lần; đơn đã mua bị hủy thì suất được trả lại trong hạn.

| Method | Path | Mô tả | Body / ghi chú |
|---|---|---|---|
| POST | `/api/groups` | Tạo nhóm, 201 chi tiết nhóm (tôi là chủ nhóm và thành viên đầu) | `{ product_id, variant_id }`; 404 `Không tìm thấy sản phẩm`; 400 `Sản phẩm này chưa mở mua nhóm.` / `Mẫu mã này đã hết hàng...` / `Mẫu mã này không thuộc sản phẩm hoặc đã ngừng bán.` / `Bạn đang mở tối đa 5 nhóm...`; 409 `Bạn đang có một nhóm mở cho sản phẩm này (mã XXXXXXXX).` |
| GET | `/api/groups/:code` | Chi tiết nhóm, **công khai** (người được mời xem trước khi đăng nhập); có đăng nhập thì kèm `me`. Mã gõ chữ thường / có dấu gạch vẫn nhận. 404 `Không tìm thấy nhóm` | - |
| POST | `/api/groups/:code/join` | Tham gia, trả chi tiết nhóm | `{ variant_id }`; 400 `Nhóm đã chốt, không nhận thêm người.` / `Nhóm đã hết hạn mà chưa đủ người.` / `Nhóm đã bị hủy.` / `Nhóm đã đủ người.`; 409 `Bạn đã ở trong nhóm này rồi.` |
| PUT | `/api/groups/:code/variant` | Đổi size / màu của mình (nhóm còn mở, hoặc đã thành công mà mình chưa mua và còn hạn) | `{ variant_id }` |
| POST | `/api/groups/:code/leave` | Rời nhóm (chỉ khi còn mở; chủ nhóm không rời được) | - |
| POST | `/api/groups/:code/cancel` | Chủ nhóm hủy nhóm còn mở; 403 người khác; 400 nhóm đã chốt thành công | - |
| GET | `/api/groups/mine` | Các nhóm tôi tham gia, mới nhất trước (tối đa 50): `[{ code, status, product_name, thumbnail, member_count, capacity, current_percent, is_leader, seconds_left, claim, claim_seconds_left }]` | - |
| GET | `/g/:code` (không có `/api`) | **Trang web mời** (HTML, công khai): tên sản phẩm, bậc giá, mã nhóm, nút "Mở trong ứng dụng" (`hfarm://group/<mã>`). Link gửi qua Zalo / Messenger là `PUBLIC_URL` + `/g/<mã>` | giới hạn 60/phút/IP; tên sản phẩm được escape HTML |

Chi tiết nhóm: `{ code, status: OPEN\|SUCCESS\|FAILED\|CANCELLED, share: { code, url, deep_link }, product: { id, name, thumbnail, price_from, status }, tiers: [{ min_members, discount_percent }], member_count, capacity (= số người của bậc cao nhất), current_tier, next_tier, members_to_next, active_percent, seconds_left (nhóm mở), claim_seconds_left (đã chốt thành công: còn bao lâu để mua giá nhóm), final_members, final_percent, members: [{ name (đã che, ví dụ "Nguyễn V. A."), is_leader, is_me }], me: null \| { is_leader, variant: { id, size_name, color_name, price, stock }, price_now, discount_now, claim: WAIT\|CAN_CLAIM\|CLAIMED\|EXPIRED\|NONE, order_id } }`. Thời gian còn lại tính bằng GIÂY do server trả (không dựa vào đồng hồ máy khách). Giới hạn tần suất của tạo / vào / đổi mẫu mã: 40/phút/IP.

### 2.6 Quà tặng (`/api/gifts`)
Người thân (vợ, bạn gái, mẹ...) chọn quà cho một bạn nam theo **dịp + size + ngân sách**, chọn thiệp, viết lời nhắn, đặt **đơn quà**. Gợi ý dùng chung bộ máy size/màu của Stylist nhưng thận trọng hơn: giày chỉ được gợi ý khi người dùng nhập size giày chắc chắn và có đúng size đó (không ước lượng theo chiều cao). Cần migration `005`.

| Method | Path | Role | Mô tả | Tham số / body chính |
|---|---|---|---|---|
| GET | `/api/gifts/options` | - | Một nguồn duy nhất cho app và CMS: `{ occasions: [{ value, label, date_text, days_left, budget_default }], cards: [{ id, name, occasions, bg, ink, accent, border, ornament, font }], wishes: { <mã dịp>: [lời chúc] }, styles, max_styles, budget: { min, max, presets }, sizes: { letters, shoe_eu }, message_max (300), sender_max (60), wrap: { variant_id, name, price, stock } \| null }`. Mã dịp: `BIRTHDAY, ANNIVERSARY, VALENTINE, WHITE_DAY, MEN_DAY (19/11), CHRISTMAS, TET, SURPRISE`. `days_left` chỉ có với dịp có ngày dương lịch cố định (tính theo giờ Việt Nam), còn lại `null`. `wrap` lấy từ sản phẩm có SKU = `GIFT_WRAP_SKU` (còn bán + còn hàng), `null` nếu chưa cấu hình | - |
| POST | `/api/gifts/suggestions` | - | **Gợi ý quà** (chỉ đọc, không lưu gì; POST để số đo không nằm trong URL; 30 lượt/phút/IP -> 429). 200 `{ profile, size_advice: { letter (áo), bottom (quần, size chữ), shoe, too_big }, main: [món], combos: [{ title, total, remaining, items: [món], highlights }], small: [món], notes, empty_reason?, min_budget? }`. `main` = tối đa 4 quà lẻ (áo / khoác / quần / giày, mỗi loại <= 2), `combos` = tối đa 3 combo 2-3 món (mỗi sản phẩm chỉ ở một combo, **tổng không vượt ngân sách**), `small` = tối đa 3 phụ kiện rẻ chưa nằm trong combo. `món` có cùng dạng với món của Stylist (`variant_id, size_name, color_name, price, size_note: EXACT\|NEAR\|null, reasons`...). `empty_reason` = `BUDGET_TOO_LOW` (+ `min_budget`) hoặc `NO_PRODUCT` | `{ occasion, budget (100.000 - 100.000.000), styles?: [0-3 mã Stylist], fit: { mode: "SIZE", top: XS\|S\|M\|L\|XL\|XXL, bottom?: XS\|S\|M\|L\|XL\|XXL (size quần, size CHỮ như áo; bỏ trống = cùng size áo; size số / inch bị từ chối), shoe?: 36-47 } \| { mode: "MEASURE", height_cm: 120-220, weight_kg: 25-150, shoe? } }`; 400 `Hãy chọn dịp tặng quà.` / `Ngân sách nên từ ...` / `Hãy chọn size áo bạn ấy đang mặc.` / `Hãy chọn size quần bạn ấy đang mặc.` / `Size giày nên từ 36 đến 47 (size EU).` / `Chiều cao nên từ ...` |
| POST | `/api/gifts/checkout` | mọi role | **Đặt đơn quà từ giỏ** (không nhận `items`): gọi `createOrder` như `POST /orders` (khóa giỏ, trừ kho, mã giảm giá, phí ship theo vùng) rồi ghi thiệp vào `order_gifts`. 201 như `POST /orders` + `gift`. `wrap` của đơn suy từ dòng hàng có SKU = `GIFT_WRAP_SKU` (khách thêm sản phẩm gói quà vào giỏ như hàng thường) | `{ address_id, payment_method: "BANK_TRANSFER", coupon_code?, customer_note?, gift: { occasion?, card_template?, card_message? (<= 300 ký tự), sender_name? (<= 60), hide_prices? (mặc định true) } }`. **Kiểm tra TRƯỚC khi tạo đơn** (lỗi nhập liệu không làm mất giỏ): 400 `Đơn quà chỉ thanh toán bằng chuyển khoản, để người nhận không phải trả tiền món quà của mình.` (COD hoặc thiếu `payment_method`) / `Cửa hàng chưa bật thanh toán chuyển khoản nên chưa nhận được đơn quà.` / `Thiếu thông tin quà tặng.` / `Mẫu thiệp không hợp lệ.` / `Dịp tặng quà không hợp lệ.` / `Lời nhắn tối đa 300 ký tự.`; còn lại như `POST /orders`. Nếu ghi thiệp lỗi sau khi đơn đã tạo: đơn tự hủy (hoàn kho) và trả 500 `Không lưu được thiệp nên đơn đã được hủy, xin lỗi bạn. Hãy chọn lại quà rồi đặt lại.` |

`gift` (trong `GET /orders/:id`, `GET /admin/orders/:id`, kết quả checkout): `{ occasion, occasion_label, card: { id, name, bg, ink, accent, border, ornament, font } \| null, card_message, sender_name, hide_prices, wrap }`. `card` là mẫu thiệp ĐẦY ĐỦ để app / CMS tự vẽ; đơn thường thì `gift = null`.

## 3. CMS (`/api/admin/*`)

Toàn bộ nhóm này đi qua `authenticate` + `requireRole('admin','staff')` (`backend/index.js`). Customer -> 403 `Không đủ quyền`. Bảng dưới ghi thêm các endpoint chỉ admin.

### 3.1 Chung
| Method | Path | Role | Mô tả | Tham số / body chính |
|---|---|---|---|---|
| GET | `/api/admin/me` | admin, staff | `{ id, email, full_name, roles }` (`roles` chỉ gồm admin/staff/customer) | - |
| POST | `/api/admin/upload` | admin, staff | Tải ảnh, 201 `{ url }` (dùng `PUBLIC_URL`) | multipart, field `file`; JPG/PNG/WebP, tối đa 5 MB. 400 `Chỉ chấp nhận ảnh JPG, PNG hoặc WebP đúng định dạng.` / `Vui lòng chọn ảnh để tải lên.`; 413 `Ảnh tải lên không được vượt quá 5 MB.` |
| GET | `/api/admin/stats` | admin, staff | `{ orders_by_status, revenue (đơn COMPLETED), active_products, customers, low_stock (<= 5, tối đa 10), top_products (5, bỏ đơn hủy/hoàn trả) }` | - |
| GET | `/api/admin/stats/revenue` | admin, staff | `{ days, data: [{ date, revenue, order_count }] }` (đơn COMPLETED, có cả ngày 0 đơn) | `days` 1-365 (mặc định 30); 400 `Số ngày cần nằm trong khoảng 1 đến 365.` |

### 3.2 Sản phẩm, mẫu mã, kho (`/api/admin/products`, `/api/admin/inventory`) - admin, staff
| Method | Path | Mô tả | Tham số / body chính |
|---|---|---|---|
| GET | `/api/admin/products` | Danh sách (cả DRAFT/INACTIVE), cùng tham số lọc như `/api/products` | thêm `status` |
| GET | `/api/admin/products/:id` | Chi tiết (cả mẫu mã không bán) | - |
| POST | `/api/admin/products` | Tạo sản phẩm (+ ảnh + mẫu mã + tồn kho ban đầu), 201 `{ id }` | `{ name, category_id, base_price` (bắt buộc; 400 `Cần tên, danh mục và giá gốc`)`, brand_id, description, status (mặc định DRAFT), images: [url\|{image_url}], variants: [{ size_id, color_id, sku, price?, compare_at_price?, image_url?, quantity? }], outfit_role?, styles?, occasions? }` (3 trường cuối là thẻ Stylist, xem dưới bảng) |
| PUT | `/api/admin/products/:id` | Sửa chung; gửi `images` (mảng) thì thay toàn bộ ảnh | `category_id, brand_id, name, description, base_price, status, images, outfit_role, styles, occasions` (gửi từng phần; thẻ xem dưới bảng) |
| DELETE | `/api/admin/products/:id` | KHÔNG xóa cứng: đặt `INACTIVE` (`Đã ngừng bán sản phẩm`) | - |
| POST | `/api/admin/products/:id/variants` | Thêm 1 mẫu mã + dòng kho, 201 `{ id }`; 404 `Không tìm thấy sản phẩm`; 400 `Mẫu mã cần size, màu và SKU` | `{ size_id, color_id, sku, price?, compare_at_price?, image_url?, quantity? }` |
| POST | `/api/admin/products/:id/variants/bulk` | Thêm nhiều mẫu mã trong một transaction, 201 `{ ids }` | `{ variants: [...] }` 1-100 phần tử; 400 `Cần gửi từ 1 đến 100 mẫu mã.` / `Thông tin mẫu mã hoặc số lượng ban đầu không hợp lệ.` |
| PUT | `/api/admin/products/variants/:variantId` | Sửa mẫu mã | `sku, price, compare_at_price, image_url, is_active` |
| POST | `/api/admin/products/variants/:variantId/stock` | Nhập/xuất/điều chỉnh kho, trả `{ quantity }` | `{ type: IMPORT\|EXPORT\|ADJUSTMENT (ADJUSTMENT = đặt thẳng về số này), quantity, note? }`; 400 `Loại thao tác không hợp lệ` / `Số lượng không hợp lệ` / `Không đủ tồn kho (còn N)` |
| GET | `/api/admin/products/variants/:variantId/movements` | 50 dòng lịch sử kho mới nhất | - |
| GET | `/api/admin/inventory` | Tồn kho theo mẫu mã: `{ data: [{ variant_id, product_id, product_name, thumbnail, sku, size_name, color_name, price, stock_quantity, is_active }], page, limit, total, stats: { variants, low_stock, out_of_stock } }` | `q` (tên/SKU), `category_id`, `low=1` (<= 5), `out=1` (= 0), `page`, `limit` |

Thẻ Stylist của sản phẩm (cột trong `products`, migration 003): `outfit_role` = `TOP`\|`BOTTOM`\|`OUTERWEAR`\|`SHOES`\|`ACCESSORY` hoặc `null` (chưa gắn thẻ: sản phẩm KHÔNG xuất hiện trong gợi ý bộ đồ; gửi `""` hoặc `null` để xóa); `styles`, `occasions` = mảng mã (gửi mảng hoặc chuỗi `"A,B"`; rỗng = hợp mọi phong cách / hoàn cảnh; GET trả mảng). Mã lạ (kể cả `DRESS` cũ): 400 `Vai trò trong bộ đồ không hợp lệ` / `Phong cách không hợp lệ: <mã>` / `Hoàn cảnh không hợp lệ: <mã>`. Danh sách `GET /api/admin/products` có thêm `outfit_role` để CMS hiện sản phẩm nào còn thiếu thẻ. Cột `products.gender` (có từ migration 003) và giá trị `DRESS` không còn được dùng (cửa hàng chỉ bán đồ nam); trường `gender` gửi lên bị bỏ qua.

### 3.3 Đơn hàng (`/api/admin/orders`) - admin, staff
| Method | Path | Mô tả | Tham số / body chính |
|---|---|---|---|
| GET | `/api/admin/orders` | `{ data: [{ id, order_code, recipient_name, recipient_phone, total_amount, status, payment_status, created_at, customer_email, carrier, tracking_code, payment_method, is_gift (0/1), gift_wrap (0/1) }], page, limit, total }` | `status` (nhiều giá trị cách nhau dấu phẩy), `gift` (`1` chỉ đơn quà tặng, `wrap` chỉ đơn quà cần gói hộp), `payment_status` (`UNPAID\|PAID\|PARTIALLY_REFUNDED\|REFUNDED\|FAILED`), `q` (mã đơn/tên/SĐT/mã vận đơn), `page`, `limit`; sai -> 400 `Trạng thái đơn hàng không hợp lệ: <X>` / `Trạng thái thanh toán không hợp lệ: <X>` |
| GET | `/api/admin/orders/counts` | Số đơn mỗi trạng thái (đủ 7 khóa) | - |
| POST | `/api/admin/orders/bulk` | Xử lý 1-100 đơn theo "bước tiếp theo". `{ results: [{ id, order_code, ok, status, tracking_code?, error? }], succeeded, failed }` | `{ ids: [..], action: confirm\|ship\|complete\|cancel\|return, note?, carrier?, tracking_code? (chỉ khi 1 đơn) }`; 400 `Thao tác không hợp lệ` / `Chưa chọn đơn hàng nào` / `Mã đơn hàng không hợp lệ` / `Chỉ xử lý tối đa 100 đơn mỗi lần` / `Chỉ nhập mã vận đơn khi xử lý một đơn` |
| GET | `/api/admin/orders/:id` | Chi tiết đầy đủ (kèm `customer_name/email/phone`, `items`, `history`, `payment`, `shipment`, `payment_expires_at`, `shipment_events`, `gift`: thiệp / ẩn giá / gói quà hoặc `null`) | 404 `Không tìm thấy đơn hàng` |
| POST | `/api/admin/orders/:id/confirm-payment` | Xác nhận ĐÃ NHẬN TIỀN (đơn chuyển khoản/online): `payment_status = PAID`, ghi lịch sử, trả chi tiết đơn | `{ transaction_code? (<= 150), note? (<= 300) }`; 400 `Đơn này đã được xác nhận thanh toán` / `Đơn thanh toán khi nhận hàng được thu tiền lúc giao, không cần xác nhận` / `Đơn đã hủy hoặc hoàn trả nên không nhận thanh toán được` |
| POST | `/api/admin/orders/:id/shipment-events` | Ghi mốc hành trình khi đơn đang `SHIPPING` (khách thấy trong app), 201 `{ id }` | `{ title (<= 200), location? (<= 150) }`; 400 `Chỉ ghi hành trình khi đơn đang giao` |
| DELETE | `/api/admin/orders/:id/shipment-events/:eventId` | Xóa mốc hành trình; 404 `Không tìm thấy mục hành trình` | - |
| PATCH | `/api/admin/orders/:id/status` | Đổi đúng một bước, trả chi tiết đơn | `{ status, note?, carrier?, tracking_code? }`; 400 `Thiếu trạng thái` / `Không thể chuyển từ "<nhãn>" sang "<nhãn>"` / `Mã vận đơn này đã được dùng cho đơn khác` / `Mã vận đơn tối đa 150 ký tự` / `Tên đơn vị vận chuyển tối đa 100 ký tự` |
| PATCH | `/api/admin/orders/:id/note` | Lưu ghi chú nhân viên (`staff_note`) | `{ staff_note }` |

Mã vận đơn tự sinh khi sang `SHIPPING` mà không nhập: `HF` + yyMMdd + 6 ký tự (ví dụ `HF261118K7M2QP`).

### 3.4 Đánh giá (`/api/admin/reviews`) - admin, staff
| Method | Path | Mô tả | Tham số / body chính |
|---|---|---|---|
| GET | `/api/admin/reviews` | `{ data: [{ id, rating, comment, status, created_at, product_id, product_name, thumbnail, user_name, user_email, order_code }], page, limit, total }` | `status` (`PENDING\|APPROVED\|REJECTED`), `rating` (1-5), `q`, `page`, `limit`; 400 `Trạng thái đánh giá không hợp lệ: <X>` / `Số sao lọc phải từ 1 đến 5` |
| GET | `/api/admin/reviews/counts` | `{ PENDING, APPROVED, REJECTED }` | - |
| POST | `/api/admin/reviews/bulk-status` | Duyệt/ẩn nhiều đánh giá: `{ updated, requested }` (`REJECTED` = ẩn khỏi cửa hàng) | `{ ids: [..] (<= 100), status }`; 400 `Trạng thái không hợp lệ` / `Chưa chọn đánh giá nào` / `Mã đánh giá không hợp lệ` / `Chỉ xử lý tối đa 100 đánh giá mỗi lần` |
| DELETE | `/api/admin/reviews/:id` | Xóa; 404 `Không tìm thấy đánh giá` | - |

### 3.5 Danh mục, thương hiệu, size, màu - ĐỌC: admin, staff; GHI: chỉ admin
`/api/admin/categories`, `/brands`, `/sizes`, `/colors` có cùng bốn thao tác (middleware `writeAdminOnly` ở `admin/index.js`: `GET/HEAD/OPTIONS` mọi nhân viên, còn lại chỉ admin; staff ghi -> 403 `Không đủ quyền`).

| Method | Path | Mô tả | Body chính |
|---|---|---|---|
| GET | `/api/admin/<bảng>` | Toàn bộ dòng (sizes xếp `sort_order, id`) | - |
| POST | `/api/admin/<bảng>` | Tạo, 201 `{ id }`; thiếu tên -> 400 `Thiếu tên`. Danh mục tự sinh `slug` | categories: `name, description, parent_id, is_active`; brands: `name, description, logo_url, is_active`; sizes: `name, sort_order`; colors: `name, hex_code` |
| PUT | `/api/admin/<bảng>/:id` | Sửa một phần; 400 `Không có dữ liệu để cập nhật` | như trên |
| DELETE | `/api/admin/<bảng>/:id` | Xóa cứng; đang được dùng -> 409 `Đang được sử dụng ở nơi khác nên không thể xóa. Hãy chuyển sang ngừng hoạt động` | - |

### 3.6 Khách hàng và mã giảm giá - CHỈ admin
| Method | Path | Mô tả | Tham số / body chính |
|---|---|---|---|
| GET | `/api/admin/users` | `{ data: [{ id, email, full_name, phone, user_type, status, created_at, order_count, total_spent }], page, limit, total }` | `type` (`CUSTOMER`...), `status` (`ACTIVE\|INACTIVE\|BLOCKED`; sai -> 400 `Trạng thái tài khoản không hợp lệ: <X>`), `q`, `page`, `limit` |
| GET | `/api/admin/users/:id/orders` | Lịch sử đơn + dòng hàng của một KHÁCH (`user_type=CUSTOMER`; không thì 404 `Không tìm thấy khách hàng`) | `page`, `limit` |
| PATCH | `/api/admin/users/:id/status` | Khóa/mở tài khoản (người bị khóa nhận 403 `Tài khoản đã bị khóa` ở lần gọi sau) | `{ status: ACTIVE\|INACTIVE\|BLOCKED }`; 400 `Trạng thái không hợp lệ` |
| GET | `/api/admin/coupons` | Toàn bộ mã giảm giá | - |
| POST | `/api/admin/coupons` | Tạo, 201 `{ id }`; thiếu trường -> 400 `Thiếu <tên_cột>` | `code, discount_type (PERCENTAGE\|FIXED_AMOUNT), discount_value, starts_at, ends_at` (bắt buộc), `description, min_order_amount, max_discount, usage_limit, per_user_limit, is_active` |
| PUT | `/api/admin/coupons/:id` | Sửa một phần (không có API xóa mã) | như trên |

### 3.7 Vận chuyển và giao dịch ngân hàng
| Method | Path | Role | Mô tả | Body / tham số chính |
|---|---|---|---|---|
| GET | `/api/admin/shipping-zones` | admin, staff | Mọi vùng (kể cả đang tắt): `[{ id, name, provinces: [..] \| null, is_default, fee, free_over, eta_min_days, eta_max_days, is_active }]` | - |
| POST | `/api/admin/shipping-zones` | **admin** | Tạo vùng (không phải mặc định), 201 `{ id }` | `{ name, provinces: [..] (>= 1), fee, free_over?, eta_min_days, eta_max_days, is_active? }`; 400 `"<tỉnh>" đã thuộc vùng "<tên>"` / `Vùng không phải mặc định cần ít nhất một tỉnh/thành` / `Phí vận chuyển không hợp lệ` |
| PUT | `/api/admin/shipping-zones/:id` | **admin** | Sửa; vùng mặc định chỉ sửa được tên/phí/ngưỡng/ngày (không đổi loại, không tắt) | như trên |
| DELETE | `/api/admin/shipping-zones/:id` | **admin** | Xóa vùng; vùng mặc định -> 400 `Không xóa được vùng mặc định` | - |
| GET | `/api/admin/bank-transactions` | admin, staff | Giao dịch tiền vào nhận qua webhook: `{ data: [{ id, provider, provider_tx_id, amount, content, transaction_time, match_status, note, resolved, order_id, order_code, order_total, order_status }], page, limit, total }` | `resolved=0` (cần xử lý) \| `1`, `page`, `limit` |
| PATCH | `/api/admin/bank-transactions/:id/resolve` | admin, staff | Đánh dấu đã xử lý (đã hoàn tiền/đã đối soát); 404 `Không tìm thấy giao dịch` | - |

### 3.8 Banner trang chủ - CHỈ admin
| Method | Path | Mô tả | Body chính |
|---|---|---|---|
| GET | `/api/admin/banners` | Mọi banner (kể cả tắt/hết hạn), theo `sort_order` | - |
| POST | `/api/admin/banners` | Tạo, 201 `{ id }` | `{ title (<= 150), subtitle? (<= 250), image_url (http...; tải ảnh bằng /admin/upload), link_type, link_value, sort_order?, is_active?, starts_at?, ends_at? ("YYYY-MM-DD HH:mm") }`; 400 `Hãy chọn danh mục` / `Sản phẩm không tồn tại` / `Bộ sưu tập không hợp lệ` / `Ngày kết thúc phải sau ngày bắt đầu` |
| PUT | `/api/admin/banners/:id` | Sửa (gửi đủ trường); 404 `Không tìm thấy banner` | như trên |
| DELETE | `/api/admin/banners/:id` | Xóa | - |

### 3.9 Mua nhóm - admin, staff
| Method | Path | Mô tả | Body / tham số |
|---|---|---|---|
| GET | `/api/admin/products/:id/group-buy` | Cấu hình mua nhóm của sản phẩm `{ enabled, hours, tiers: [{ min_members, discount_percent }] }` (`enabled` = đã bật VÀ có ít nhất một bậc) | 404 `Không tìm thấy sản phẩm` |
| PUT | `/api/admin/products/:id/group-buy` | Lưu cấu hình, trả cấu hình mới. Tắt mà không gửi bậc thì giữ nguyên các bậc đang lưu | `{ enabled, hours (1-720, mặc định 48), tiers }`; tối đa 5 bậc, `min_members` nguyên 2-50, `discount_percent` > 0 và <= 80, bậc nhiều người hơn phải giảm nhiều hơn; 400 `Cần ít nhất một bậc giá mua nhóm.` / `Số người mỗi bậc phải là số nguyên từ 2 đến 50.` / `Phần trăm giảm phải lớn hơn 0 và không quá 80.` / `Hai bậc giá không được cùng số người.` / `Bậc nhiều người hơn phải giảm nhiều hơn.` / `Thời gian rủ bạn phải từ 1 đến 720 giờ.` |
| GET | `/api/admin/groups` | `{ data: [{ id, code, status, product_id, product_name, leader_name, member_count, capacity, final_members, final_percent, expires_at, seconds_left, claim_until, bought_count, discount_total, created_at, tiers }], page, limit, total }` (không có email) | `status`, `page`, `limit`; 400 `Trạng thái nhóm không hợp lệ: <mã>` |
| POST | `/api/admin/groups/:code/cancel` | Hủy nhóm đang mở. 400 nếu nhóm đã chốt thành công (thành viên đã được hưởng giá nhóm) | - |

## 4. Ghi chú khi dùng
- Mã giảm giá không phân biệt hoa/thường (do collation MySQL).
- `GET /api/orders` (khách) trả mảng, còn `GET /api/admin/orders` trả `{ data, page, limit, total }`.
- Khi thêm endpoint mới: thêm vào bảng ở đây và vào mục phân quyền của [ARCHITECTURE.md](ARCHITECTURE.md); mọi route admin phải đi qua middleware role ở backend.

## 5. Thanh toán chuyển khoản VietQR và webhook
- **Bật chuyển khoản**: đặt `BANK_BIN` (6 số NAPAS), `BANK_ACCOUNT_NO`, `BANK_ACCOUNT_NAME` (và `BANK_NAME`) trong `backend/.env`. Thiếu thì `GET /payments/methods` chỉ trả `COD` và `POST /orders` với `BANK_TRANSFER` bị 400.
- **Mã QR** sinh tại server theo chuẩn VietQR/NAPAS 247 (EMVCo, CRC16): đúng số tiền, nội dung chuyển khoản = mã đơn (`HT` + ngày + 5 số). Không gọi dịch vụ ngoài.
- **Hạn trả** `PAYMENT_HOLD_MINUTES` (mặc định 1440): quá hạn mà đơn còn `PENDING` + `UNPAID` thì backend (mỗi phút) tự hủy, hoàn kho và hoàn lượt mã giảm giá. Đơn nhân viên đã xác nhận thì không tự hủy.
- **Webhook SePay** (`POST /api/payments/webhook/sepay`): chỉ bật khi đặt `PAYMENT_WEBHOOK_KEY`. Chỉ xử lý `transferType = "in"`; tìm mã đơn (`HT` + 13 số) trong `code`/`content` (bỏ ký tự phân cách, không phân biệt hoa thường). Chống xử lý trùng theo `(provider, id)`. Kết quả ghi ở `bank_transactions.match_status`:
  - `MATCHED`: đủ tiền -> đơn `PAID` (chuyển thiếu rồi bù thì cộng dồn). Chuyển dư vẫn `MATCHED` nhưng ghi chú "cần hoàn lại" và chờ nhân viên.
  - `AMOUNT_MISMATCH` (thiếu), `ALREADY_PAID` (chuyển trùng), `ORDER_CLOSED` (đơn đã hủy/quá hạn, KHÔNG mở lại đơn), `UNMATCHED` (không có mã đơn, đơn không tồn tại/không chọn chuyển khoản, sai tài khoản nhận): hiện ở CMS > Giao dịch ngân hàng để nhân viên xử lý. Hoàn tiền làm ngoài hệ thống.
- Chỉ định dạng SePay được cài; nhà cung cấp khác cần thêm bộ chuyển đổi vào `routes/payments.js` (hàm `processIncomingTransfer` dùng chung).
