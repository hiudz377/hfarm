# Kế hoạch app mobile khách hàng (Expo)

Quy ước: `[x]` = đã viết xong và đã kiểm tra tự động (xem "Mức kiểm tra GĐ1", "GĐ2", "GĐ3" bên dưới); `[ ]` = chưa làm.
**Chưa có mục nào được thử trên điện thoại / Expo Go** - cần bạn thử tay theo `README.md`.
Keycloak đã được gắn (đăng nhập + đăng ký ngay trong app: xem mục 4.11 và `README.md`; chế độ `dev` vẫn dùng được). **Chưa** chạy `npm run setup:keycloak` trên Keycloak thật của chủ dự án và chưa thử đăng nhập trên điện thoại thật. Các ghi chú "chưa làm Keycloak" ở phần mô tả từng giai đoạn bên dưới là lịch sử lúc đó. Bức tranh hiện tại: `../docs/STATUS.md`.

## Giai đoạn 1 - Khung + Cửa hàng + Chi tiết

- [x] Khởi tạo Expo (SDK 58) + Expo Router (JavaScript), thư mục `src/{app,api,auth,components,utils}`
- [x] Theme xanh `#2E7D32`, component nhỏ: Button, Card, Chip, EmptyState, Loading, Photo, QuantityStepper, ProductCard
- [x] 4 tab: Cửa hàng, Giỏ hàng, Đơn hàng, Tài khoản (3 tab sau là màn tạm, làm ở GĐ2/GĐ3)
- [x] `.env` / `.env.example` (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_AUTH_MODE=dev`)
- [x] Axios instance duy nhất (`src/api/client.js`), timeout 10s, thông báo lỗi tiếng Việt
- [x] AuthProvider `{ status, user, signOut, getAccessToken }`, chế độ dev gửi `X-Dev-Role: customer`
- [x] Backend: `X-Dev-Role` (admin|staff|customer) chỉ khi `AUTH_ENABLED != 'true'` (`backend/src/middleware/auth.js`)
- [x] Cửa hàng: lưới 2 cột, tìm kiếm (debounce 400ms), chip danh mục, tải thêm khi cuộn, kéo để làm mới
- [x] Cửa hàng: trạng thái loading / lỗi (nút Thử lại) / trống
- [x] Chi tiết sản phẩm: ảnh (vuốt), mô tả, chọn màu + size (tổ hợp hết hàng làm mờ), số lượng, "Thêm vào giỏ"
- [x] Chi tiết: trạng thái loading / lỗi (nút Thử lại)
- [x] README.md (cách chạy, lấy IP LAN, lỗi kết nối hay gặp)

### Mức kiểm tra GĐ1
- Đã chạy: `npx expo-doctor` 20/20; `npx expo export` bundle được Android + iOS; `node --check` + test logic middleware backend (stub DB).
- Đã chạy: bản web (react-native-web, trong thư mục tạm, không nằm trong repo) trên Edge, nối API giả đúng định dạng backend: 47 kiểm tra đạt (cuộn tải thêm, debounce, lọc, lỗi/trống/Thử lại, chọn màu/size/làm mờ, giới hạn số lượng, gọi `POST /cart/items`, header `X-Dev-Role`, sửa URL ảnh).
- Đã đọc dữ liệu thật qua `GET /api/products*` của backend (chỉ đọc).
- **Chưa kiểm tra**: chạy trên điện thoại/Expo Go; hộp thoại `Alert` sau khi thêm vào giỏ và `router.navigate('/cart')` (chỉ chạy trên native); gọi API có header `customer` vào DB thật (sẽ tự tạo user `dev-customer`); đăng nhập Keycloak.
- Lưu ý bản web: nhãn thanh tab bị cụt phần dưới chữ (nhãn cao 10px, `overflow: hidden`). Chưa biết có xảy ra trên native không, hãy nhìn trên điện thoại.

## Giai đoạn 2 - Giỏ hàng + Thanh toán

Backend (nhỏ):
- [x] `POST /api/orders/quote { items?, coupon_code }` -> `{ subtotal, discount_amount, shipping_fee, total_amount }`; không ghi DB, không kiểm tra tồn kho
- [x] `services/orders.js`: tách `resolveItems / mergeLines / priceLines / applyCoupon / computeTotals` dùng chung cho `createOrder` và `quoteOrder` (hai bên luôn khớp). Hành vi đặt hàng + trừ kho giữ nguyên
- [x] Thay đổi nhỏ có chủ đích: `POST /orders` trả thêm `order_code`; thông báo "Đơn tối thiểu 1.000.000đ..." có dấu chấm ngăn cách (trước là `1000000đ`)

Mobile:
- [x] Giỏ hàng (`/api/cart`): stepper số lượng (chặn theo tồn kho), xóa có xác nhận, cảnh báo hết hàng / vượt tồn ("Đổi về N"), tạm tính, "Thanh toán" bị khóa khi còn mục lỗi
- [x] Mã giảm giá trong giỏ: xem trước bằng `/orders/quote`, tự tính lại khi đổi số lượng, báo lỗi tiếng Việt, "Bỏ mã"
- [x] Giỏ trống có nút "Đi mua sắm"; badge số món (số dòng, không phải tổng số lượng) trên tab Giỏ hàng
- [x] Chi tiết sản phẩm: "Thêm vào giỏ" ghi giỏ mới vào cache nên badge/giỏ đổi ngay; chặn thêm quá tồn kho (tính cả phần đã có trong giỏ)
- [x] Thanh toán: chọn địa chỉ (`/me/addresses`, mặc định chọn sẵn), thêm địa chỉ mới ngay tại đây (tự chọn địa chỉ vừa tạo), COD / Chuyển khoản (thông tin giả định ở `src/utils/bankConfig.js`), ghi chú, tóm tắt tiền từ `/orders/quote`
- [x] "Đặt hàng" (`POST /orders`): chống bấm đúp, lỗi hết hàng báo thân thiện + làm mới giỏ, mất kết nối giữa chừng thì tải lại giỏ: giỏ đã trống = đơn có thể đã được tạo, không bắt đặt lại
- [x] Màn "Đặt hàng thành công": mã đơn, tổng tiền, hướng dẫn chuyển khoản (nội dung = `HFARM <mã đơn>`), nút "Xem đơn hàng" / "Về cửa hàng"
- [x] Kiểm tra địa chỉ trước khi gửi (`src/utils/validate.js`): bắt buộc đủ 6 trường, độ dài theo schema, SĐT di động VN (chấp nhận +84/84, dấu cách/chấm/gạch, lưu về dạng `0xxxxxxxxx`)
- [x] React Query: khóa chung `['cart']`, `['quote', ...]`, `['addresses']` (`src/utils/useCart.js`); sau đặt hàng làm mới giỏ, tồn kho sản phẩm, mã giảm giá, đơn hàng
- [x] Loading / lỗi (nút Thử lại) / trống cho giỏ, thanh toán, địa chỉ, tóm tắt tiền
- [x] Sửa lỗi GĐ1 phát hiện khi test: nút "Xem giỏ hàng" dùng `router.navigate('/cart')` làm chồng thêm một bản `(tabs)` lên Stack -> đổi sang `goToTab` (`router.dismissTo`)

### Mức kiểm tra GĐ2
Đã chạy thật:
- `npx expo-doctor` 20/20; `npx expo export` bundle được Android + iOS (dùng Node 24; Node mặc định của máy là 20.18, thấp hơn yêu cầu >= 22.13 của app).
- `validate.js`: 9 nhóm test thuần (SĐT hợp lệ/không hợp lệ, +84, thiếu từng trường, độ dài, trường rỗng/null).
- Backend, đối chiếu bản `createOrder` GỐC với bản mới trên DB giả: 26 kịch bản (giỏ/body, biên 500.000, mã %/cố định/trần, hết lượt, quá lượt mỗi người, tối thiểu, mẫu mã ngừng bán, hết kho + rollback, địa chỉ, payment_method lạ...) cho **cùng chuỗi SQL, kết quả, lỗi và tồn kho**; `quoteOrder` khớp `createOrder` và không phát câu ghi/khóa nào.
- API thật trên **MySQL thật** nhưng ở một **database tạm** (`hfarm_scratch_p2`, dựng từ `schema.sql` + dữ liệu mẫu nhỏ, đã xóa xong; `clothing_store` không bị đụng): 21 nhóm kiểm tra (quote đủ trường hợp, quote không đổi kho/mã/đơn, địa chỉ mặc định, đặt hàng khớp quote, `payments`, `used_count`, lỗi hết kho + rollback, mã một lần mỗi người).
- **E2E trình duyệt**: bản web của app (Expo Router thật + react-native-web, ở thư mục tạm ngoài repo) trên Edge -> backend thật -> DB tạm; **30 bước đạt**: badge ngay khi thêm giỏ, chặn quá tồn, stepper, cảnh báo vượt tồn/hết hàng, xóa có xác nhận (Hủy/Xóa), mã giảm giá (sai/tối thiểu/đúng/tự tính lại), thanh toán, thêm địa chỉ (lỗi từng ô, SĐT sai, +84), tự chọn địa chỉ mới, chuyển khoản, **bấm đúp chỉ tạo 1 đơn**, kiểm tra đơn trong DB, tồn kho sản phẩm cập nhật sau đặt, lỗi hết hàng lúc đặt, mất kết nối trước/sau khi server ghi đơn, mã bị vô hiệu giữa chừng, giỏ trống, chỉ có 1 thanh tab sau khi điều hướng, console không lỗi.

**Chưa kiểm tra** (cần bạn thử trên điện thoại):
- Chạy trên điện thoại / Expo Go (chưa thử lần nào).
- Hộp thoại `Alert` native: bản web dùng bản vá ghi lại nội dung + nút, nên chỉ kiểm tra được chữ và hành vi nút, không phải giao diện hộp thoại thật.
- Điều hướng native: `router.dismissTo` chạy đúng trên web (cùng router) nhưng chưa thử native; `presentation: 'modal'` của form địa chỉ; ẩn nút quay lại + chặn vuốt ở màn thành công (`headerBackVisible`/`headerLeft`/`gestureEnabled`); bàn phím che ô nhập (`KeyboardAvoidingView`) ở form địa chỉ / ghi chú (GĐ3 đã sửa lại cách dùng, xem bên dưới); `Switch`; giao diện badge native trên tab.
- Ảnh sản phẩm trong giỏ (dữ liệu thử không có ảnh nên chỉ thấy ô xám; cách tải ảnh giữ nguyên GĐ1).
- Không có lần ghi nào vào database thật `clothing_store`; chưa có lần chạy với dữ liệu thật của bạn.
- Lưu ý còn đó từ GĐ1: nhãn thanh tab có thể bị cụt phần dưới chữ (thấy trên web, chưa biết trên native).

### Phát hiện về backend (lúc làm GĐ2; trạng thái hiện tại ghi ở từng dòng)
- ~~`POST /orders` không có khóa/idempotency~~ **Đã xử lý ở mục 4.10**: `createOrder` khóa dòng giỏ trong transaction, đọc lại hàng trong giỏ và chỉ nhận giỏ còn `ACTIVE`; bấm đặt hai lần chỉ tạo một đơn (12/12 lần thử). Còn lại: đặt bằng `items` trong body (không qua giỏ) vẫn không có khóa chống gửi trùng (app luôn đặt từ giỏ). App vẫn giữ lớp chặn bấm đúp và tự kiểm tra giỏ khi mất kết nối giữa chừng.
- ~~Mã đơn `HT<ngày><5 chữ số ngẫu nhiên>` có thể trùng~~ **Đã xử lý ở mục 4.10**: trùng `order_code` thì tự thử mã khác (tối đa 5 lần), khách không còn thấy lỗi 409.
- `POST /me/addresses` báo thiếu trường bằng tên cột tiếng Anh ("Thiếu recipient_name"); app đã kiểm tra trước nên không gặp. **Chưa xử lý** (cũng gặp ở `POST /admin/coupons`: "Thiếu code"...).
- Mã giảm giá không phân biệt hoa/thường (do collation MySQL): `sale10` vẫn được chấp nhận. Hành vi hiện tại, chưa có quyết định đổi.

## Giai đoạn 3 - Đơn hàng + Tài khoản

Backend (nhỏ, chỉ đổi `GET /api/orders`):
- [x] `?status=` lọc theo một hoặc nhiều trạng thái (`PENDING`, `CONFIRMED,PROCESSING,SHIPPING`); giá trị lạ -> 400 "Trạng thái đơn hàng không hợp lệ: X"; SQL dùng tham số `?`
- [x] Mỗi đơn trả thêm `item_count` (số dòng hàng) và `first_product_name`; vẫn chỉ thấy đơn của chính mình; không đổi logic khác

Mobile:
- [x] Đơn hàng: bộ lọc Tất cả / Chờ xác nhận / Đang giao / Hoàn thành / Đã hủy, phân trang (tải thêm khi cuộn, khử trùng id), thẻ đơn có mã, ngày giờ, nhãn trạng thái màu, sản phẩm đầu + "và N sản phẩm khác", số món, tổng tiền; tự tải lại khi mở lại tab và khi kéo để làm mới
- [x] Chi tiết đơn (`GET /orders/:id`): dòng thời gian từ `history`, món hàng, địa chỉ + ghi chú, vận chuyển (đơn vị + mã vận đơn nếu có), thanh toán (+ thông tin chuyển khoản nếu chưa trả), tiền; 404 có màn riêng
- [x] "Hủy đơn" chỉ khi `PENDING`: hộp thoại xác nhận, `POST /orders/:id/cancel`, chống bấm đúp, làm mới danh sách + chi tiết + tồn kho sản phẩm; nếu CMS vừa xác nhận đơn thì báo lỗi tiếng Việt và màn tự đổi trạng thái
- [x] Tài khoản: thẻ thông tin, menu, Đăng xuất; Hồ sơ: sửa họ tên (bắt buộc) + số điện thoại (không bắt buộc, VN) bằng `PUT /me`, nút Lưu khóa khi chưa đổi
- [x] Sổ địa chỉ: thêm / sửa (`address-form?id=`) / xóa có xác nhận / đặt mặc định; xóa địa chỉ mặc định thì tự chuyển mặc định sang địa chỉ mới nhất còn lại
- [x] Đăng xuất ở chế độ dev: có hộp thoại xác nhận, làm mới dữ liệu tạm, về tab Cửa hàng và nói rõ đây là chế độ dev (không có phiên thật)
- [x] Loading / lỗi (nút Thử lại) / trống cho mọi màn mới

Rà soát toàn app:
- [x] Mọi màn có loading / lỗi + Thử lại / trống (bảng kiểm bên dưới); thêm lỗi danh mục ở Cửa hàng, 404 sản phẩm, 404 đơn
- [x] SafeArea + `KeyboardView` (`KeyboardAvoidingView` có `behavior` ở cả hai nền tảng + `keyboardVerticalOffset` = chiều cao header) cho Thanh toán, Giỏ (ô mã giảm giá), Cửa hàng (ô tìm), Hồ sơ, Form địa chỉ; Chi tiết đơn chừa chỗ thanh điều hướng khi không có nút Hủy; `headerTransparent: false` cho iOS 26+
- [x] Ảnh chỉ qua `Photo` (expo-image); không có `console.*` trong `src`; bản web chạy 40 bước E2E không phát sinh lỗi/cảnh báo nào ngoài các request cố ý chặn
- [x] README mobile + README gốc cập nhật

Lỗi tìm thấy và đã sửa trong đợt rà soát (một phần do reviewer độc lập đọc toàn bộ `src`, tôi kiểm chứng từng điểm trước khi sửa):
- GĐ2 để `KeyboardAvoidingView` không có `behavior` trên Android (edge-to-edge) -> form bị bàn phím che; và thiếu offset header ở cả hai nền tảng.
- Sản phẩm bị CMS ngừng bán khi đang nằm trong giỏ: giỏ không cảnh báo, "Thanh toán" vẫn bật, thanh toán chỉ hiện "Sản phẩm (mã 123) không còn bán" rồi kẹt. Nay dòng đó được đánh dấu "Đã ngừng bán", chặn thanh toán, có lời nhắc + nút "Về giỏ hàng"; lúc đặt hàng cũng báo thân thiện.
- Hộp thoại quay lại khi mở màn bằng liên kết trực tiếp phát cảnh báo `GO_BACK` -> `goBack()` có đường lùi dự phòng.
- Lưu địa chỉ / hồ sơ rồi thoát màn sớm: callback vẫn điều hướng và lùi thêm một màn -> `useMounted`.
- Thêm vào giỏ chạm đúp có thể cộng gấp đôi (backend cộng dồn) -> ref chống bấm đúp.
- Danh sách sản phẩm không khử trùng id khi có sản phẩm mới giữa các trang; Chi tiết sản phẩm thay cả màn bằng lỗi dù còn dữ liệu cache và hiện "Thử lại" vô nghĩa cho 404.
- Vòng quay "đang làm mới" hiện mỗi lần mở tab / sau khi đặt hàng (dùng `isRefetching`) -> chỉ hiện khi người dùng kéo.
- Xóa địa chỉ mặc định mà bước chuyển mặc định lỗi thì báo nhầm "không xóa được".
- Thông báo lỗi mạng lộ URL LAN, tên biến môi trường và chữ "backend" -> chỉ hiện ở bản dev; mã trạng thái tiếng Anh trong lỗi backend ("từ CONFIRMED sang CANCELLED") được đổi sang tiếng Việt.

### Bảng kiểm 3 trạng thái (loading / lỗi + Thử lại / trống)
Cửa hàng (danh sách + danh mục) · Chi tiết sản phẩm (+404) · Giỏ hàng · Thanh toán (địa chỉ, báo giá) · Đơn hàng (trống theo từng bộ lọc) · Chi tiết đơn (+404) · Tài khoản · Hồ sơ · Sổ địa chỉ · Form địa chỉ khi sửa (+không tìm thấy). Màn thành công là màn tĩnh nên không áp dụng.

### Mức kiểm tra GĐ3
Đã chạy thật (mã cuối cùng):
- `npx expo-doctor` 20/20; `npx expo export` bundle Android + iOS (Node 24).
- Test thuần: `validate.js` 11 nhóm (thêm hồ sơ), `viMessage.js` 9 kiểm tra; đối chiếu `createOrder` gốc/mới vẫn 26/26.
- API thật trên **MySQL thật nhưng database tạm** (đã xóa; `clothing_store` còn nguyên 24 bảng, chỉ đọc metadata): lọc `?status=` (một/nhiều/sai/chèn SQL/`constructor` -> 400), `item_count`, `first_product_name`, phân trang, người dùng khác không thấy / không hủy được đơn của mình.
- **E2E trình duyệt, 2 trình duyệt chạy đồng thời**: app (Expo Router thật) + web CMS (Vite) -> cùng backend + DB tạm; **40 bước đạt** (+ **30 bước hồi quy GĐ2** đạt): danh sách 17 đơn qua 2 trang không trùng, bộ lọc gọi đúng `status`, nội dung thẻ, chi tiết đang giao có mã vận đơn + timeline, hủy đơn (xác nhận, 3 lần bấm chỉ 1 request, kho hoàn lại +2 áo +1 quần, đơn sang "Đã hủy"), CMS xác nhận đơn giữa chừng -> báo lỗi + màn tự đổi, **đổi trạng thái trên giao diện CMS rồi app thấy**, CMS hủy đơn -> kho hoàn, CMS xem tồn kho khớp DB, không có 401/403/5xx ở cả hai bên, hồ sơ (lỗi từng ô, +84, xóa số), sổ địa chỉ (thêm/sửa/xóa/mặc định, chuyển mặc định khi xóa), đăng xuất dev, lỗi + Thử lại cho từng màn, ngừng bán giữa chừng, chạm đúp thêm giỏ, danh mục lỗi, console sạch.

**Chưa kiểm tra** (cần thử trên điện thoại):
- Chạy trên điện thoại / Expo Go (chưa thử lần nào, kể cả GĐ1-2).
- Mọi thứ phụ thuộc bàn phím và vùng an toàn: `KeyboardView` (padding + offset header), `tabBarHideOnKeyboard`, insets đáy ở Chi tiết đơn, `headerTransparent: false` trên iOS 26 — chỉ suy ra từ mã nguồn RN/tài liệu Expo, web không có bàn phím mềm.
- Hộp thoại `Alert` native (web dùng bản vá ghi nội dung + nút), điều hướng native (`dismissTo`, modal form địa chỉ, ẩn nút quay lại ở màn thành công), `Switch`, `RefreshControl` kéo để làm mới, giao diện badge tab.
- Ảnh sản phẩm (dữ liệu thử không có ảnh).
- Chưa có lần chạy nào trên dữ liệu thật của bạn (database thật chỉ được đọc để lấy danh sách mã giảm giá / số lượng sản phẩm, không ghi gì).
- Nhãn thanh tab bị cụt chân chữ trên web: container nhãn co lại còn 10px (`overflow: hidden`) do chiều cao thanh tab trên web; chưa biết có xảy ra trên native không.
## Giai đoạn 4 - Mở rộng sản phẩm (đang làm)

### 4.1 Lọc và sắp xếp ở Cửa hàng
- [x] Backend `GET /api/products`: `sort` (newest | price_asc | price_desc | bestseller), `min_price`/`max_price`, `size_id`, `color_id`, `brand_id` (nhiều id), `in_stock`. `sort` chỉ nhận giá trị trong danh sách (không ghép chuỗi vào SQL); đầu vào sai trả 400. CMS dùng chung hàm nên cũng có các tham số này.
- [x] Mobile: nút "Lọc và sắp xếp" (dấu số nhóm lọc đang bật, "N sản phẩm · kiểu sắp xếp", "Xóa lọc" giữ kiểu sắp xếp), bảng trượt từ dưới lên `FilterSheet` (sắp xếp, 4 khoảng giá, size, màu có chấm màu, thương hiệu, "chỉ còn hàng"), nháp chỉ áp dụng khi bấm "Áp dụng"; màn trống có nút "Xóa bộ lọc"
- Kiểm tra đã chạy: API trên MySQL thật nhưng database tạm (đã xóa; `clothing_store` không bị đụng) 51 kiểm tra đạt (từng bộ lọc và tổ hợp, biên giá, mẫu mã ngừng bán/sản phẩm nháp không lọt vào, size + màu + còn hàng phải cùng một mẫu mã, phân trang khi sắp xếp, đầu vào xấu/chèn SQL trả 400, CMS giữ hành vi cũ); logic lọc của app 23 kiểm tra; `expo export` Android + iOS; bản web của app trên Edge nối backend + DB tạm, 32 bước đạt.
- **Chưa kiểm tra**: trên điện thoại / Expo Go (Modal trượt, `Switch`, vùng an toàn phía dưới bảng, nút Back của Android đóng bảng).

### 4.2 Size chữ / size số tách riêng + chỉ hiện mục đang dùng (sửa 4.1 theo góp ý)
- [x] Backend `GET /sizes` trả `size_group` (LETTER | NUMBER | OTHER) và xếp chữ -> số -> khác; size chữ xếp theo nghĩa (XS < S < M < L < XL < XXL = 2XL), size số theo giá trị số. Suy ra từ tên size, không đổi database. `?in_use=1` (cũng có ở `/colors`, `/brands`) chỉ trả mục có sản phẩm ĐANG BÁN dùng
- [x] Bảng lọc mobile: cụm "Size chữ" và "Size số" (+ "Khác"), tiêu đề cụm chỉ hiện khi có từ hai cụm; không còn hiện size/màu/thương hiệu mà chọn xong chỉ ra kết quả trống
- Kiểm tra đã chạy: 39 kiểm tra thuần cho nhóm/thứ tự size; API trên DB tạm (sizes, colors, brands, `in_use`, size chỉ có ở sản phẩm nháp/mẫu mã tắt bị ẩn); bản web của app 37 bước đạt (cả 4.1).

### 4.3 Mã vận đơn tự sinh + trang Đơn hàng CMS xử lý nhanh (làm ở backend + web, không đổi app mobile)
- [x] Mã vận đơn `HF` + yyMMdd + 6 ký tự (bỏ I, O, 0, 1) tự sinh khi chuyển sang Đang giao nếu không nhập; đơn vị mặc định `HFarm Express` (`DEFAULT_CARRIER`). Khách xem mã này trong chi tiết đơn trên mobile như trước
- [x] CMS: 7 trạng thái gom thành 5 tab có số đếm, tìm theo mã đơn/mã vận đơn/tên/SĐT, lọc thanh toán, nút "bước tiếp theo" trên từng dòng (Xác nhận / Giao hàng / Hoàn tất), chọn nhiều đơn để xử lý một lần, Hủy/Hoàn trả luôn hỏi lại, ngăn chi tiết có tiến trình 4 bước
- Kiểm tra đã chạy: API trên DB tạm 64 kiểm tra (xử lý hàng loạt, đơn lỗi không chặn cả lô, mã vận đơn duy nhất, hoàn kho, hai nhân viên bấm cùng lúc, đầu vào xấu, phân quyền); CMS thật trên Edge 40 bước đạt; build CMS thành công.
- **Chưa kiểm tra**: `DEFAULT_CARRIER` đặt qua `.env`; bản CMS khi đăng nhập Keycloak thật (chỉ thử ở chế độ `VITE_AUTH_DISABLED`); nhiều hơn vài chục đơn (chưa thử hiệu năng).

### 4.4 Gợi ý tìm kiếm + lịch sử tìm kiếm
- [x] Backend `GET /products/suggest?q=` (không phân biệt hoa/thường và dấu, xếp: bắt đầu bằng -> đầu một từ -> chứa giữa; `% _ ` coi là chữ thường)
- [x] Mobile: vào ô tìm kiếm hiện lớp riêng thay cho danh sách. Chưa gõ: "Tìm kiếm gần đây" (xóa từng mục / xóa tất cả, lưu bằng `@react-native-async-storage/async-storage`, tối đa 8) + "Phổ biến" (6 sản phẩm bán chạy). Đang gõ: dòng "Tìm “...”" + gợi ý sản phẩm có ảnh, giá và chữ khớp tô đậm. Hủy / nút Back Android thoát tìm kiếm
- Thay đổi hành vi có chủ đích: danh sách **không còn lọc ngay khi gõ**; áp dụng khi bấm Enter, chọn gợi ý hoặc chọn từ lịch sử. Chạm lại vào ô đang chứa từ khóa vừa tìm thì hiện lịch sử (gõ khác đi mới hiện gợi ý)
- Phụ thuộc mới: `@react-native-async-storage/async-storage` 2.2.0 (có sẵn trong Expo Go SDK 58, không cần development build)

### 4.5 Chi tiết sản phẩm đầy đủ hơn + sản phẩm liên quan
- [x] Thư viện ảnh có ảnh nhỏ bấm chuyển, nhãn giảm giá và giá gạch ngang (chỉ khi đã chọn phiên bản hoặc mọi phiên bản cùng giá, để không hiện nhãn đi kèm khoảng giá), đánh giá sao + "Đã bán N", khối "Thông tin sản phẩm" (danh mục, thương hiệu, SKU của phiên bản đang chọn, tình trạng), mô tả "Xem thêm / Thu gọn", chia sẻ (`Share` của React Native), phần Đánh giá (điểm trung bình + phân bố + danh sách, tải thêm), dải ngang "Sản phẩm liên quan"
- [x] Backend: `GET /products/:id/related`; chi tiết trả `rating_avg`, `rating_count`, `sold_count`, mẫu mã xếp size chữ trước size số (XS < S < M < L < XL < 2XL, số tăng dần); thẻ sản phẩm có giá gạch + nhãn giảm giá + điểm đánh giá

### 4.6 Yêu thích
- [x] Backend `/api/favorites` (ids, danh sách phân trang, thích, bỏ thích; thích lặp lại vẫn một dòng; sản phẩm bị ẩn không hiện trong danh sách)
- [x] Mobile: trái tim trên mọi thẻ sản phẩm và ảnh chi tiết (cập nhật lạc quan, lỗi thì hoàn lại + báo), màn "Yêu thích" từ tab Tài khoản (bỏ tim thì thẻ biến mất ngay), chưa đăng nhập thì mời đăng nhập

### 4.7 Đánh giá sản phẩm
- [x] Backend: `POST /api/reviews` (chỉ món trong đơn Hoàn thành của chính mình, mỗi món một lần, chống gửi đúp bằng khóa dòng), `GET /products/:id/reviews` (chỉ đã duyệt, tên người đánh giá được che); trạng thái đầu `PENDING`
- [x] Mobile: nút "Đánh giá sản phẩm" cho từng món trong đơn Hoàn thành -> màn chọn sao + nhận xét; sau đó hiện "Bạn đã đánh giá N sao · chờ duyệt / đã hiển thị / đã ẩn"; tên sản phẩm trong đơn bấm mở trang sản phẩm
- [x] CMS: trang "Đánh giá" (tab Chờ duyệt / Đã duyệt / Đã ẩn / Tất cả có số đếm, tìm theo sản phẩm/người/nội dung, lọc số sao, duyệt / ẩn / duyệt lại từng cái hoặc hàng loạt), huy hiệu số chờ duyệt trên menu

### 4.8 CMS đẹp và chuyên nghiệp hơn
- [x] Tổng quan: khu "Cần xử lý" (đơn chờ xác nhận, đánh giá chờ duyệt, mẫu mã sắp hết hàng, bấm để tới trang tương ứng), dòng số liệu phụ dưới thẻ KPI, bảng "Đơn hàng gần đây", biểu đồ trạng thái đơn dùng đúng màu nhãn trạng thái
- [x] Sản phẩm: ảnh nhỏ + thương hiệu/danh mục dưới tên, giá gạch, nhãn tồn kho theo mức (hết hàng / sắp hết / còn), điểm đánh giá, bộ lọc nằm trong thẻ, thao tác bằng nút biểu tượng có chú thích; favicon HFarm
- Các trang còn lại (Khách hàng, Mã giảm giá, Danh mục/Thương hiệu, Size & Màu, Kho hàng, ngăn sản phẩm, khung giao diện) đã làm đẹp ở mục 4.12; màn đăng nhập Keycloak của CMS vẫn chưa đụng tới

### 4.9 Docker Compose
- [x] `docker-compose.yml` + Dockerfile backend + Dockerfile web (build tĩnh, nginx): MySQL riêng trong container (volume), nạp `schema.sql` lần đầu, backend có healthcheck, ảnh tải lên có volume; cổng mặc định 3100 / 8088 / 3307 để không đụng bản dev; cấu hình qua `.env` (mẫu `.env.example`). Chi tiết ở README mục 5

### Mức kiểm tra GĐ4 (4.4 - 4.9), đã chạy thật
- API trên MySQL thật nhưng database tạm (đã xóa): 64 kiểm tra (đơn hàng, size) + 76 kiểm tra (gợi ý, liên quan, yêu thích, đánh giá, duyệt)
- Logic thuần: nhóm/thứ tự size 39, lịch sử tìm kiếm + tô chữ khớp 23, bộ lọc 23
- Bản web của app (Expo Router thật, Edge) nối backend + DB tạm: bảng lọc 37 bước, tìm kiếm/chi tiết/yêu thích/đánh giá 45 bước; `expo export` Android + iOS thành công
- CMS (Vite, Edge): Đơn hàng 40 bước, Đánh giá/Tổng quan/Sản phẩm 24 bước; `vite build` thành công
- Docker Compose (project và cổng riêng, đã dọn sạch): build 3 image, MySQL tự nạp schema, API/ảnh/đặt hàng, nginx phục vụ CMS (SPA fallback, cache), dữ liệu + ảnh còn nguyên sau `restart` và sau `down` rồi `up`, backend tự nối lại khi MySQL khởi động lại, CMS trong container chạy trên trình duyệt
- **Chưa kiểm tra**: trên điện thoại / Expo Go (bảng lọc trượt, `Share`, AsyncStorage thật, hộp thoại `Alert` native, nút Back Android khi đang tìm kiếm, ảnh thật từ máy chủ); CMS khi đăng nhập Keycloak thật (chỉ thử ở chế độ `VITE_AUTH_DISABLED`); Docker ở chế độ Keycloak và việc nạp dữ liệu bằng `mysqldump` (lệnh ghi trong README chưa thử trên dữ liệu thật); hiệu năng với nhiều sản phẩm / đánh giá

### 4.10 Đặt hàng đồng thời (kiểm tra + sửa)
- Kiểm tra thật trên MySQL: tồn 5, 3 người cùng đặt 3 (8 lần thử) luôn đúng 1 đơn thành công, kho còn 2; tồn 5 + 20 yêu cầu cùng lúc = đúng 5 đơn, kho về 0 (không âm); 30 đơn 2 sản phẩm theo thứ tự ngược nhau không deadlock; mã giảm giá còn 1 lượt + 3 người dùng cùng lúc = đúng 1 người. Cơ chế: `SELECT ... FOR UPDATE` dòng tồn kho trong transaction (và dòng mã giảm giá), khóa theo thứ tự id.
- **Lỗi thật đã sửa**: một người bấm đặt hai lần cùng lúc (hai yêu cầu lấy hàng từ giỏ) tạo HAI đơn và trừ kho hai lần (12/12 lần thử). Nay `createOrder` khóa dòng giỏ trong transaction, đọc lại hàng trong giỏ và chỉ nhận giỏ còn `ACTIVE`: yêu cầu thứ hai báo "Giỏ hàng trống". 12/12 lần thử chỉ tạo đúng 1 đơn, kho trừ đúng.
- Sửa thêm: trùng mã đơn (ngẫu nhiên 5 số) trước đây báo lỗi 409 cho khách; nay tự thử mã khác (tối đa 5 lần).
- Chưa làm: khóa chống đặt trùng khi gửi đơn bằng `items` trong body (app luôn đặt từ giỏ), giữ chỗ hàng trong giỏ (hàng chỉ bị trừ lúc đặt: giỏ đầy nhưng hết hàng lúc thanh toán sẽ báo "Không đủ tồn kho").

### 4.11 Đăng nhập + đăng ký ngay trong app
- [x] Màn `/login`: form email + mật khẩu, tab Đăng nhập / Đăng ký, hiện/ẩn mật khẩu, kiểm tra ngay trên máy, lỗi tiếng Việt (sai thông tin, tài khoản khóa, đã đăng ký, mật khẩu chưa đạt chính sách...), tự đăng nhập sau khi đăng ký; tab Giỏ hàng / Đơn hàng / Tài khoản chuyển tới màn này
- [x] Backend: `POST /api/auth/register` (Keycloak Admin API bằng tài khoản dịch vụ, role customer, giới hạn tần suất, dọn tài khoản dở dang), `GET /api/auth/config`; script `npm run setup:keycloak` cấu hình Keycloak một lần (bật Direct access grants, tạo client dịch vụ, cấp quyền tối thiểu, in/ghi secret)
- Dự phòng: client chưa bật Direct access grants hoặc backend chưa bật đăng ký thì app hiện nút dùng trang Keycloak như trước
- Thêm `role="button"` cho component Button dùng chung (truy cập được hơn)
- Kiểm tra đã chạy (Keycloak 26.8.1 THẬT trong container thử nghiệm riêng, không đụng Keycloak của người dùng): script + API 67 kiểm tra (chạy lại an toàn, quyền tối thiểu, đăng ký, trùng email, dữ liệu sai, chính sách mật khẩu, thiếu role -> dọn tài khoản, token dịch vụ hết hạn tự làm mới, CORS, 429, backend chưa cấu hình / sai secret / Keycloak chết); logic thuần 50 kiểm tra; giao diện trên Edge nối backend + Keycloak thật 32 bước (không mở trang/cửa sổ nào khác, mật khẩu không lọt vào URL/console, tải lại vẫn đăng nhập, realm bắt xác minh email, client tắt Direct access grants, backend báo không hỗ trợ đăng ký trong app)
- **Chưa kiểm tra**: Keycloak THẬT của người dùng (chưa chạy script trên đó; container `keycloak-hfarm` đang tắt), điện thoại / Expo Go, gửi email xác minh / quên mật khẩu (cần SMTP của realm), CMS đăng nhập (vẫn qua trang Keycloak, không đổi)

### 4.12 CMS chuyên nghiệp và đẹp hơn nữa (làm nốt các trang còn lại + khung giao diện)
- [x] Khung: menu bên thu gọn được (nhớ lựa chọn, tự thu gọn trên màn hình hẹp, khi thu gọn tiêu đề nhóm thành vạch kẻ), breadcrumb, chuông "Cần xử lý" (đơn chờ xác nhận / đánh giá chờ duyệt / mẫu mã sắp hết hàng, bấm để tới trang tương ứng), tiêu đề tab trình duyệt theo trang, màu / bo góc / bảng / nút đồng bộ qua theme chung
- [x] Khách hàng: ảnh đại diện chữ cái đầu + tên + email, tìm kiếm, lọc Tất cả / Hoạt động / Đã khóa (API `GET /api/admin/users?status=`), cột chi tiêu + ngày tham gia, khóa / mở khóa có hộp xác nhận, ngăn lịch sử mua hàng có thống kê
- [x] Mã giảm giá: tab theo trạng thái (Đang chạy / Sắp diễn ra / Hết lượt / Hết hạn / Đã tắt) có số đếm, tìm kiếm, sao chép mã, huy hiệu ưu đãi, thanh lượt dùng đổi màu, ghi chú thời hạn ("Còn 5 ngày"), bật / tắt và sửa ngay trên dòng
- [x] Size & Màu: size chia cụm Size chữ / Size số / Khác, xếp đúng thứ tự không phụ thuộc lúc thêm (sửa điểm yếu đã ghi ở 4.8); màu dạng thẻ có chấm màu + mã hex; báo rõ khi xóa size / màu đang được dùng
- [x] Danh mục / Thương hiệu (trang CRUD dùng chung): bỏ cột ID, tìm kiếm, lọc trạng thái, đếm, hộp xác nhận xóa nói rõ hậu quả (thương hiệu: sản phẩm sẽ không còn thương hiệu; danh mục đang có sản phẩm: không xóa được)
- [x] Kho hàng: thẻ KPI bấm để lọc (hết hàng / sắp hết / tất cả), tìm kiếm, ảnh + SKU, nhãn tồn kho theo mức; Tổng quan: biểu đồ doanh thu dạng vùng
- [x] Ngăn sản phẩm: tiêu đề là tên sản phẩm + nhãn trạng thái, nút Lưu / Đóng cố định ở chân ngăn, các ô nhập rộng đều, chấm màu ở bảng mẫu mã
- Sửa trong lúc kiểm tra: tooltip của nút xóa / khóa nằm đè lên hộp xác nhận (che nút Hủy / Đồng ý) → component dùng chung `ConfirmButton` (áp dụng cho Khách hàng, Size & Màu, Danh mục / Thương hiệu, Sản phẩm); lỗi kiểm tra form (ô trống) thành "unhandled rejection" trong console ở mọi form (nay dùng `validate()` trong `utils.js`); cảnh báo `useForm is not connected` ở bản dev (Modal có `forceRender`); Tổng quan, Danh mục, Thương hiệu tràn ngang trên điện thoại (bảng cuộn ngang trong thẻ)
- Kiểm tra đã chạy (Edge + Vite, backend + MySQL tạm, chế độ `VITE_AUTH_DISABLED`): trang mới 75 bước (lọc / khóa / mở khóa / lịch sử, tab + tìm + sao chép + bật tắt + tạo / sửa mã và báo lỗi nhập, cụm size + thêm + xóa đang dùng / không dùng, màu, danh mục / thương hiệu, KPI kho + nhập kho + lịch sử, ngăn sản phẩm, thu gọn menu + nhớ lựa chọn, chuông, màn hình hẹp, không lỗi console); chạy lại bộ cũ: Đơn hàng 40 bước, Tổng quan / Sản phẩm / Đánh giá 24 bước đều đạt; 10 trang không tràn ngang ở 390 / 768 / 1024 px; `vite build` thành công
- **Chưa kiểm tra**: CMS khi đăng nhập Keycloak thật (menu theo vai trò staff / admin chỉ thử ở chế độ dev), Safari / Firefox (chỉ thử Edge), màn hình hẹp chỉ kiểm tra không tràn ngang và xem ảnh chụp (chưa dùng trên máy thật), hiệu năng với hàng nghìn khách / mã giảm giá (bảng Khách hàng phân trang phía máy chủ, Mã giảm giá lọc phía trình duyệt trên toàn bộ danh sách), màn đăng nhập Keycloak của CMS (chưa làm theme thương hiệu)
- Ghi chú: trong lúc kiểm tra có hai lần (trên tổng cộng khoảng 8 lần chạy bước này) bấm nút "Mở khóa" trong hộp xác nhận bị quá thời gian chờ của Playwright dù hộp xác nhận đang hiện bình thường trên ảnh chụp; sau đó lặp lại 25 vòng khóa / mở khóa liên tiếp đều đạt và bộ 75 bước chạy lại đều đạt (cả lần cuối); chưa tìm ra nguyên nhân chắc chắn, nghi do thời điểm chạy của bài kiểm tra

### 4.13 Thanh toán QR, giao hàng theo vùng, trang chủ mới (2026-11-24)
- [x] Backend: migration 001/002; VietQR tự sinh (không gọi dịch vụ ngoài); webhook SePay; xác nhận tay trong CMS; tự hủy đơn chuyển khoản quá hạn (hoàn kho + hoàn lượt mã giảm giá); vùng ship + ETA; hành trình + tra cứu công khai; banner; `on_sale`; thumbnail danh mục.
- [x] CMS: trang Vận chuyển, Giao dịch ngân hàng, Banner; chi tiết đơn có "Xác nhận đã nhận tiền" + hành trình + tem in có QR.
- [x] App: tab Trang chủ (banner, ưu đãi lấy từ cấu hình thật, danh mục, 3 dải sản phẩm), tab Cửa hàng nhận tham số từ trang chủ, khung chờ (skeleton), thẻ sản phẩm mới (nhãn Mới / -% / Hết hàng), thanh "Đã thêm vào giỏ" thay hộp thoại, thông tin giao hàng ở chi tiết sản phẩm, phí ship + ETA theo địa chỉ ở Thanh toán, QR + đếm ngược + tự cập nhật, theo dõi đơn (mã vận đơn sao chép được, timeline gộp). Xóa `BankInfo` và `bankConfig` (thông tin giả).
- Sửa khi kiểm tra: nhãn thanh tab trên web bị cắt nửa chữ (nhãn bị co còn 7px do `flex-shrink`), sửa bằng `tabBarLabelStyle.flexShrink: 0`; test cũ báo đạt nhầm vì đo nhầm phần tử, đã siết lại.
- Kiểm tra: xem `docs/STATUS.md` mục 2.1 (backend 125 bước, CMS 26 bước, app web 58 bước, đều trên database tạm). **Chưa kiểm tra**: điện thoại thật, quét QR bằng app ngân hàng thật, webhook SePay thật, in tem ra giấy.

### 4.14 Liên hệ, chính sách, hướng dẫn chọn size, hỗ trợ đổi trả (2026-11-25)
Làm theo đánh giá "app còn thiếu gì để dùng thật" (chưa cần tên miền/máy chủ).
- [x] Backend: `GET /api/store` (công khai, chỉ đọc `STORE_*` + `RETURN_DAYS` trong `.env`, giá trị sai định dạng thành `null`); biến mẫu giả trong `.env.example` (backend + gốc) và truyền trong `docker-compose.yml`.
- [x] App: màn `contact`, `policy/[slug]` (đổi trả / bảo mật / điều khoản), `size-guide` (modal, gợi ý size theo chiều cao + cân nặng); `ContactActions` (Gọi / Zalo / Email); mục Hỗ trợ + phiên bản ở Tài khoản; "Liên hệ & chính sách" ở lời mời đăng nhập; dòng đồng ý điều khoản ở tab Đăng ký; khối "Cần hỗ trợ?" ở chi tiết đơn (lời nhắn theo trạng thái, email có sẵn mã đơn); liên kết "Hướng dẫn chọn size" cạnh nhãn Size ở trang sản phẩm.
- [x] Nội dung ở `src/content/` (`policies.js`, `sizeGuide.js`) là **bản nháp mẫu** cần chủ cửa hàng rà soát (số đo tham khảo, không phải số đo thật; không phải tư vấn pháp lý).
- Sửa khi kiểm tra: `getPolicy('constructor')` (mở `/policy/constructor`) làm sập màn vì tra cứu thẳng vào object; nay chỉ nhận slug trong `POLICY_SLUGS`. Chữ "1–2 cm" bị ngắt dòng giữa chừng nên đổi thành "1 đến 2 cm".
- Bẫy khi test web: RNW mở `tel:` bằng `window.location = ...` (không chặn được bằng `window.open`); test bọc `URL` để bắt. Kiểm tra: `docs/STATUS.md` mục 2.1. **Chưa kiểm tra**: điện thoại thật (mở app gọi/Zalo/thư, bàn phím số), trang đăng nhập dạng modal mở chính sách trên native.

### 4.15 Stylist cá nhân: gợi ý cả bộ đồ (2026-11-26)
Ý tưởng của chủ dự án: thay vì khách tự tìm đồ, app đóng vai stylist ("Hôm nay mặc gì?"): nhập giới tính, chiều cao, cân nặng, phong cách, hoàn cảnh, ngân sách -> nhận bộ đồ hoàn chỉnh, mua cả bộ hoặc từng món. Chủ dự án chọn **bộ máy chấm điểm trên server** (không dùng LLM: miễn phí, tức thì, không gửi số đo ra ngoài).
- [x] Database: migration `003_outfit_stylist.sql` thêm 4 cột vào `products` (`gender`, `outfit_role`, `styles`, `occasions`); backend từ chối khởi động nếu thiếu (`migrations.js`), `docker-compose.yml` nạp tự động volume mới.
- [x] Backend: `services/stylist.js` (bộ máy thuần, không đụng database: size theo số đo cùng bảng với màn Hướng dẫn chọn size, chọn mẫu mã đúng size, chấm điểm phong cách/hoàn cảnh/màu/đánh giá, duyệt tổ hợp, **không bao giờ vượt ngân sách**, tối đa 3 bộ khác nhau, lý do + "cần ngân sách từ X để thêm giày"), `routes/stylist.js` (`GET /api/stylist/options`, `POST /api/stylist/outfits`, giới hạn 30 lượt/phút/IP), thẻ Stylist trong `POST/PUT /api/admin/products` (kiểm tra mã), `getProduct` trả `styles[]`, `occasions[]`.
- [x] CMS: mục "Gợi ý bộ đồ (Stylist)" trong ngăn sản phẩm (vai trò, phong cách, hoàn cảnh) + cột "Phối đồ" ở danh sách (thấy sản phẩm nào chưa gắn thẻ).
- [x] App: màn `stylist` (form + kết quả), `OutfitCard` (từng món có nút thêm riêng, "Thêm cả bộ vào giỏ", món đã có trong giỏ thì bỏ qua để không nhân đôi), thẻ mời ở Trang chủ, nhớ thông tin lần trước (AsyncStorage `hfarm.stylist.profile`). Mua vẫn đi qua `POST /cart/items` từng món nên luồng giỏ/đặt hàng/trừ kho KHÔNG đổi.
- [x] Test trong repo (đầu tiên của dự án): `cd backend && npm test` (13 test, gồm 400 lượt ngẫu nhiên kiểm tra bất biến ngân sách/hàng còn; đã thử phá code cố ý 5 kiểu, đều bị bắt).
- Kiểm tra: xem `docs/STATUS.md` mục 2.1. **Chưa kiểm tra**: điện thoại thật; migration 003 trên `clothing_store` thật (người dùng phải chạy); chất lượng gợi ý với dữ liệu thẻ thật do nhân viên gắn.
- [x] Đính chính cùng ngày (chủ dự án: "ui shop đồ nam thôi"): cửa hàng CHỈ bán đồ nam -> gỡ chọn giới tính (Nam/Nữ/Khác), vai trò váy/đầm và chữ "chân váy" khỏi API, app, CMS; ô tìm kiếm Trang chủ ghi "Tìm áo, quần, giày...". Cột `products.gender` và giá trị `DRESS` còn trong database (migration 003 đã chạy lên DB thật, migration chỉ được thêm) nhưng không dùng.
- Hạn chế: chỉ phối sản phẩm đã gắn thẻ; size giày chỉ ước lượng theo chiều cao; điểm số/trọng số là kinh nghiệm (chỉnh ở đầu `services/stylist.js`), chưa có "đổi món", chưa lưu bộ đồ yêu thích.

### 4.16 Mua nhóm + phong cách Luxury / Nhật Bản (2026-11-26)
Chủ dự án: thêm phong cách Luxury và Nhật Bản cho Stylist; thêm "group buy": áo 300.000 ₫, nhóm 3 người 270.000 ₫/người, nhóm 5 người 240.000 ₫/người, tạo nhóm và gửi link mời bạn bè, đủ số lượng thì tự áp mức giá tương ứng. Chủ dự án chọn **sửa một đoạn nhỏ ở `services/orders.js`** (ngoại lệ cho quy tắc cấm đổi logic đặt hàng) thay vì phát voucher.
- [x] Stylist: thêm `LUXURY` ("Luxury") và `JAPANESE` ("Nhật Bản") (tối đa 3 phong cách; hai phong cách này ưa màu trung tính như Minimalist). Chỉ là mã trong code, không cần migration (cột `styles` là chuỗi); sản phẩm của chủ dự án cần được gắn thẻ mới tính.
- [x] Database: migration `004_group_buy.sql` (3 bảng + 2 cột `products`); backend từ chối khởi động nếu thiếu.
- [x] Backend: `services/groupBuy.js` (bậc giá, tạo / vào / rời / hủy / đổi mẫu mã, chốt nhóm, tác vụ mỗi phút, `groupDiscount`), `routes/groups.js`, trang mời `routes/groupPage.js`, admin `routes/admin/groups.js` + `:id/group-buy`. `orders.js`: `quoteOrder` và `createOrder` tính giảm nhóm TRƯỚC mã giảm giá (mã tính trên phần còn lại), thêm `group_discount` vào báo giá / đơn / chi tiết đơn.
- [x] App: thẻ "Mua nhóm" ở trang sản phẩm (bậc giá theo mẫu mã đang chọn), màn `group/[code]` (tiến độ theo bậc, đếm ngược theo giây của server, thành viên đã che tên, Mời bạn bè qua Share, đổi size/màu, rời / hủy, "Mua với giá nhóm" thêm vào giỏ), màn `groups` (nhập mã + nhóm của tôi), dòng "Giá mua nhóm" ở giỏ / thanh toán / chi tiết đơn, nhãn "Mua nhóm giảm đến N%" trên thẻ sản phẩm, mục "Mua nhóm của tôi" ở Tài khoản.
- [x] CMS: mục "Mua nhóm" trong ngăn sản phẩm (bật/tắt, giờ, các bậc có xem trước giá, nút lưu riêng), trang "Mua nhóm" (danh sách, lọc, hủy nhóm), chi tiết đơn ghi "trong đó mua nhóm".
- Kiểm tra: xem `docs/STATUS.md` mục 2.1. **Chưa kiểm tra**: điện thoại thật; mở link `hfarm://group/<mã>` và `PUBLIC_URL/g/<mã>` từ Zalo / Messenger trên điện thoại; migration 004 trên `clothing_store` thật.
- Hạn chế: không thu tiền trước nên không có "bảo đảm" mua; tồn kho không giữ chỗ; một người dùng nhiều tài khoản có thể tự lập nhóm để lấy giá giảm (chưa chặn); chưa có thông báo đẩy khi nhóm chốt (khách phải mở app xem).

## Giả định và việc cần quyết định sau

- Dữ liệu: repo không có dữ liệu mẫu sản phẩm, nên cần tự có sản phẩm (nhập qua web CMS) mới thấy gì ở Cửa hàng.
- Ảnh: backend lưu URL ảnh theo `PUBLIC_URL` (mặc định `http://localhost:3000`). App tự đổi `localhost` sang host của `EXPO_PUBLIC_API_URL`.
- GĐ2 - mã giảm giá (đã giải quyết): thêm `POST /orders/quote`; mã được truyền từ giỏ sang thanh toán bằng tham số route `?coupon=` và **luôn được kiểm tra lại** ở thanh toán và ở `POST /orders`. Mã được lưu trong state của màn Giỏ (không lưu bền): thoát app thì phải nhập lại.
- GĐ2 - phí ship (đã giải quyết): app không còn hằng số phí ship; luôn lấy `shipping_fee` / `total_amount` từ `/orders/quote` (30.000 ₫, miễn phí từ 500.000 ₫ nằm trong `backend/src/services/orders.js`).
- GĐ2 - giỏ hàng (đã giải quyết ở phía app): backend vẫn cộng dồn và không giới hạn theo tồn kho, nên app tự chặn (`stock` từ `/cart`) + cảnh báo mục vượt tồn/hết hàng + chặn "Thanh toán"; nếu `POST /orders` vẫn trả "Không đủ tồn kho" thì báo thân thiện và làm mới giỏ. `/orders/quote` cố ý **không** kiểm tra tồn kho (chỉ tính tiền).
- GĐ2 - chuyển khoản (**đã giải quyết ở 4.13, 2026-11-24**: tài khoản nhận tiền lấy từ `BANK_*` trong `backend/.env`, đã xóa `bankConfig.js`). Lúc đó: backend chỉ ghi `payment_method = BANK_TRANSFER`, chưa có thông tin tài khoản; app hiển thị thông tin giả định ở `src/utils/bankConfig.js`. Chưa có bước xác nhận đã chuyển tiền: cửa hàng đối soát thủ công.
- GĐ3 - bộ lọc đơn: yêu cầu chỉ có 5 nhóm nên tôi **gom** để đơn nào cũng nằm trong một nhóm: "Đang giao" = `CONFIRMED,PROCESSING,SHIPPING`, "Đã hủy" = `CANCELLED,RETURNED`. Nhãn trên từng thẻ vẫn là trạng thái thật (Đã xác nhận / Đang xử lý / Hoàn trả...). Muốn tách riêng "Đang xử lý" chỉ cần thêm một dòng vào `ORDER_FILTERS` (`src/utils/orderStatus.js`).
- GĐ3 - `item_count` là **số dòng hàng**, không phải tổng số lượng (cùng cách đếm với badge giỏ hàng).
- GĐ3 - trạng thái đơn không đẩy thời gian thực: app tải lại khi mở lại tab/màn và khi kéo để làm mới (`staleTime: 0` cho đơn hàng).
- GĐ3 - đăng xuất ở chế độ dev: không có phiên thật để xóa. Nút vẫn có (xác nhận -> làm mới dữ liệu tạm -> về Cửa hàng) và hiện rõ "chế độ dev". Khi gắn Keycloak chỉ cần để `signOut()` trong `AuthProvider` xóa token thật.
- GĐ3 - xóa địa chỉ mặc định: backend không tự chọn địa chỉ khác nên app tự chuyển mặc định sang địa chỉ mới nhất còn lại. Địa chỉ đang mặc định không thể "bỏ mặc định" (phải đặt địa chỉ khác làm mặc định).
- GĐ3 - hồ sơ: email chỉ xem (đến từ tài khoản đăng nhập); số điện thoại bỏ trống = xóa số (lưu `null`).
- Dữ liệu thật hiện có (đọc ngày 16/11/2026): 3 sản phẩm đang bán nhưng chỉ 2 mẫu mã, tổng tồn 6, 0 đơn; **không có mã `WELCOME10`**, chỉ có `HFARM1` (giảm 15%, tối đa 50.000 ₫, đơn từ 200.000 ₫, hiệu lực 27/11 - 12/12/2026, tối đa 9 lượt, 1 lượt/người) nên hôm nay chưa dùng được.
