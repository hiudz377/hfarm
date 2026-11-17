# Kế hoạch app mobile khách hàng (Expo)

Quy ước: `[x]` = đã viết xong và đã kiểm tra tự động (xem "Mức kiểm tra GĐ1", "GĐ2", "GĐ3" bên dưới); `[ ]` = chưa làm.
**Chưa có mục nào được thử trên điện thoại / Expo Go** - cần bạn thử tay theo `README.md`.
Chưa làm Keycloak: chỉ chừa chỗ (`TODO(keycloak)` trong `src/auth/AuthProvider.js` và `src/api/client.js`).

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
- Backend, đối chiếu bản `createOrder` GỐC với bản mới trên DB giả: 26 kịch bản (giỏ/body, biên 500.000, mã %/cố định/trần, hết lượt, quá lượt mỗi người, tối thiểu, biến thể ngừng bán, hết kho + rollback, địa chỉ, payment_method lạ...) cho **cùng chuỗi SQL, kết quả, lỗi và tồn kho**; `quoteOrder` khớp `createOrder` và không phát câu ghi/khóa nào.
- API thật trên **MySQL thật** nhưng ở một **database tạm** (`hfarm_scratch_p2`, dựng từ `schema.sql` + dữ liệu mẫu nhỏ, đã xóa xong; `clothing_store` không bị đụng): 21 nhóm kiểm tra (quote đủ trường hợp, quote không đổi kho/mã/đơn, địa chỉ mặc định, đặt hàng khớp quote, `payments`, `used_count`, lỗi hết kho + rollback, mã một lần mỗi người).
- **E2E trình duyệt**: bản web của app (Expo Router thật + react-native-web, ở thư mục tạm ngoài repo) trên Edge -> backend thật -> DB tạm; **30 bước đạt**: badge ngay khi thêm giỏ, chặn quá tồn, stepper, cảnh báo vượt tồn/hết hàng, xóa có xác nhận (Hủy/Xóa), mã giảm giá (sai/tối thiểu/đúng/tự tính lại), thanh toán, thêm địa chỉ (lỗi từng ô, SĐT sai, +84), tự chọn địa chỉ mới, chuyển khoản, **bấm đúp chỉ tạo 1 đơn**, kiểm tra đơn trong DB, tồn kho sản phẩm cập nhật sau đặt, lỗi hết hàng lúc đặt, mất kết nối trước/sau khi server ghi đơn, mã bị vô hiệu giữa chừng, giỏ trống, chỉ có 1 thanh tab sau khi điều hướng, console không lỗi.

**Chưa kiểm tra** (cần bạn thử trên điện thoại):
- Chạy trên điện thoại / Expo Go (chưa thử lần nào).
- Hộp thoại `Alert` native: bản web dùng bản vá ghi lại nội dung + nút, nên chỉ kiểm tra được chữ và hành vi nút, không phải giao diện hộp thoại thật.
- Điều hướng native: `router.dismissTo` chạy đúng trên web (cùng router) nhưng chưa thử native; `presentation: 'modal'` của form địa chỉ; ẩn nút quay lại + chặn vuốt ở màn thành công (`headerBackVisible`/`headerLeft`/`gestureEnabled`); bàn phím che ô nhập (`KeyboardAvoidingView`) ở form địa chỉ / ghi chú (GĐ3 đã sửa lại cách dùng, xem bên dưới); `Switch`; giao diện badge native trên tab.
- Ảnh sản phẩm trong giỏ (dữ liệu thử không có ảnh nên chỉ thấy ô xám; cách tải ảnh giữ nguyên GĐ1).
- Không có lần ghi nào vào database thật `clothing_store`; chưa có lần chạy với dữ liệu thật của bạn.
- Lưu ý còn đó từ GĐ1: nhãn thanh tab có thể bị cụt phần dưới chữ (thấy trên web, chưa biết trên native).

### Phát hiện về backend (chưa sửa, ngoài phạm vi "không đổi hành vi đặt hàng")
- `POST /orders` không có khóa/idempotency: giỏ được đọc **ngoài** transaction, hai yêu cầu song song cho cùng giỏ về lý thuyết có thể tạo 2 đơn (trong lần thử của tôi yêu cầu thứ hai nhận "Giỏ hàng trống", nhưng đó là may rủi về thời điểm). App chặn bấm đúp và, khi mất kết nối giữa chừng, tự kiểm tra giỏ trước khi cho đặt lại.
- Mã đơn `HT<ngày><5 chữ số ngẫu nhiên>` có thể trùng (rất hiếm) -> khách thấy "Dữ liệu bị trùng (ví dụ SKU, tên, mã)".
- `POST /me/addresses` báo thiếu trường bằng tên cột tiếng Anh ("Thiếu recipient_name"); app đã kiểm tra trước nên không gặp. Chưa Việt hóa vì GĐ3 yêu cầu backend chỉ đổi `GET /orders`.
- Mã giảm giá không phân biệt hoa/thường (do collation MySQL): `sale10` vẫn được chấp nhận.

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
- Kiểm tra đã chạy: API trên MySQL thật nhưng database tạm (đã xóa; `clothing_store` không bị đụng) 51 kiểm tra đạt (từng bộ lọc và tổ hợp, biên giá, biến thể ngừng bán/sản phẩm nháp không lọt vào, size + màu + còn hàng phải cùng một biến thể, phân trang khi sắp xếp, đầu vào xấu/chèn SQL trả 400, CMS giữ hành vi cũ); logic lọc của app 23 kiểm tra; `expo export` Android + iOS; bản web của app trên Edge nối backend + DB tạm, 32 bước đạt.
- **Chưa kiểm tra**: trên điện thoại / Expo Go (Modal trượt, `Switch`, vùng an toàn phía dưới bảng, nút Back của Android đóng bảng).

## Giả định và việc cần quyết định sau

- Dữ liệu: `database/seed.sql` mà README gốc nhắc **không có trong repo**, nên cần tự có sản phẩm (nhập qua web CMS) mới thấy gì ở Cửa hàng.
- Ảnh: backend lưu URL ảnh theo `PUBLIC_URL` (mặc định `http://localhost:3000`). App tự đổi `localhost` sang host của `EXPO_PUBLIC_API_URL`.
- GĐ2 - mã giảm giá (đã giải quyết): thêm `POST /orders/quote`; mã được truyền từ giỏ sang thanh toán bằng tham số route `?coupon=` và **luôn được kiểm tra lại** ở thanh toán và ở `POST /orders`. Mã được lưu trong state của màn Giỏ (không lưu bền): thoát app thì phải nhập lại.
- GĐ2 - phí ship (đã giải quyết): app không còn hằng số phí ship; luôn lấy `shipping_fee` / `total_amount` từ `/orders/quote` (30.000 ₫, miễn phí từ 500.000 ₫ nằm trong `backend/src/services/orders.js`).
- GĐ2 - giỏ hàng (đã giải quyết ở phía app): backend vẫn cộng dồn và không giới hạn theo tồn kho, nên app tự chặn (`stock` từ `/cart`) + cảnh báo mục vượt tồn/hết hàng + chặn "Thanh toán"; nếu `POST /orders` vẫn trả "Không đủ tồn kho" thì báo thân thiện và làm mới giỏ. `/orders/quote` cố ý **không** kiểm tra tồn kho (chỉ tính tiền).
- GĐ2 - chuyển khoản: backend chỉ ghi `payment_method = BANK_TRANSFER`, chưa có thông tin tài khoản. App hiển thị thông tin **giả định** lấy từ `src/utils/bankConfig.js` - phải thay bằng tài khoản thật (hoặc lấy từ API khi backend có) trước khi phát hành. Chưa có bước xác nhận đã chuyển tiền: cửa hàng đối soát thủ công.
- GĐ3 - bộ lọc đơn: yêu cầu chỉ có 5 nhóm nên tôi **gom** để đơn nào cũng nằm trong một nhóm: "Đang giao" = `CONFIRMED,PROCESSING,SHIPPING`, "Đã hủy" = `CANCELLED,RETURNED`. Nhãn trên từng thẻ vẫn là trạng thái thật (Đã xác nhận / Đang xử lý / Hoàn trả...). Muốn tách riêng "Đang xử lý" chỉ cần thêm một dòng vào `ORDER_FILTERS` (`src/utils/orderStatus.js`).
- GĐ3 - `item_count` là **số dòng hàng**, không phải tổng số lượng (cùng cách đếm với badge giỏ hàng).
- GĐ3 - trạng thái đơn không đẩy thời gian thực: app tải lại khi mở lại tab/màn và khi kéo để làm mới (`staleTime: 0` cho đơn hàng).
- GĐ3 - đăng xuất ở chế độ dev: không có phiên thật để xóa. Nút vẫn có (xác nhận -> làm mới dữ liệu tạm -> về Cửa hàng) và hiện rõ "chế độ dev". Khi gắn Keycloak chỉ cần để `signOut()` trong `AuthProvider` xóa token thật.
- GĐ3 - xóa địa chỉ mặc định: backend không tự chọn địa chỉ khác nên app tự chuyển mặc định sang địa chỉ mới nhất còn lại. Địa chỉ đang mặc định không thể "bỏ mặc định" (phải đặt địa chỉ khác làm mặc định).
- GĐ3 - hồ sơ: email chỉ xem (đến từ tài khoản đăng nhập); số điện thoại bỏ trống = xóa số (lưu `null`).
- Dữ liệu thật hiện có (đọc ngày 16/11/2026): 3 sản phẩm đang bán nhưng chỉ 2 biến thể, tổng tồn 6, 0 đơn; **không có mã `WELCOME10`**, chỉ có `HFARM1` (giảm 15%, tối đa 50.000 ₫, đơn từ 200.000 ₫, hiệu lực 27/11 - 12/12/2026, tối đa 9 lượt, 1 lượt/người) nên hôm nay chưa dùng được.
