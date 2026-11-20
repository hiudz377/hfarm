# Tình trạng dự án HFarm

> Cập nhật: 2026-11-18 (commit `09ed775`). **Khi xong một tính năng hoặc kiểm tra thêm điều gì, sửa file này trước khi báo xong.**
> Nguồn: code hiện tại + nhật ký kiểm tra trong `mobile/PLAN.md` + ghi chú của chủ dự án. Phần "đã kiểm tra" do các phiên trước báo; tài liệu này không chạy lại chúng (trừ mục 2.3).

## 1. Đã làm (theo module)

### Database (`database/schema.sql`)
- 22 bảng + 2 view (`v_product_stock`, `v_order_summary`), ràng buộc CHECK/UNIQUE/FK, dữ liệu mẫu 6 size, 5 màu, 4 danh mục. Có các ràng buộc chống dữ liệu sai (tồn kho không âm, giá không âm, SKU/mã đơn/mã vận đơn duy nhất).
- Chưa có `database/migrations/`, chưa có seed (xem mục 3).

### Backend (`backend/`)
- Xác thực Keycloak (JWKS, nhiều issuer, đồng bộ bảng `users` theo `sub`, 401/403/503 phân biệt) + chế độ dev `X-Dev-Role`; phân quyền admin/staff ở backend.
- Danh mục công khai: lọc, sắp xếp, phân trang, gợi ý tìm kiếm, sản phẩm liên quan, size chữ/số, `?in_use=1`.
- Giỏ hàng, báo giá (`/orders/quote`), đặt hàng trong transaction (khóa kho, mã giảm giá, phí ship, tự thử lại khi trùng mã đơn, khóa giỏ chống đặt hai lần), hủy/hoàn trả có hoàn kho, xử lý hàng loạt, mã vận đơn tự sinh.
- Hồ sơ + sổ địa chỉ, yêu thích, đánh giá (khách gửi `PENDING`, CMS duyệt), mã giảm giá, thống kê/doanh thu, nhập/xuất/điều chỉnh kho + lịch sử, tải ảnh.
- Đăng ký ngay trong app qua Keycloak Admin API (client `hfarm-backend`), giới hạn tần suất, script `npm run setup:keycloak`.

### Web CMS (`web/`)
- Đăng nhập Keycloak (keycloak-js, PKCE S256), làm mới token, xử lý 401/403, menu + route theo vai trò.
- 9 trang: Tổng quan (KPI, biểu đồ, "Cần xử lý"), Sản phẩm (+ngăn biến thể/kho/ảnh), Đơn hàng (5 tab, xử lý hàng loạt, chi tiết), Đánh giá (duyệt), Khách hàng, Mã giảm giá, Danh mục, Thương hiệu, Size & Màu, Kho hàng. Giao diện tiếng Việt, tiền `1.250.000 ₫`.

### Mobile (`mobile/`)
- Expo SDK 58 + Expo Router + React Query. Tab Cửa hàng (tìm kiếm + gợi ý + lịch sử, bảng lọc/sắp xếp), Giỏ hàng (mã giảm giá), Đơn hàng (lọc, chi tiết, hủy), Tài khoản; chi tiết sản phẩm (ảnh, đánh giá, liên quan, chia sẻ), thanh toán (COD/chuyển khoản), địa chỉ, yêu thích, gửi đánh giá.
- Đăng nhập/đăng ký trong app (form email + mật khẩu), luồng trình duyệt dự phòng, refresh token trong SecureStore, chế độ dev.

### Hạ tầng
- `docker-compose.yml` (MySQL riêng + backend + nginx CMS), Dockerfile backend/web, `.env.example` cho compose.
- Keycloak 26.8.1 chạy trong container `keycloak-hfarm` với volume `hfarm_keycloak` (không nằm trong compose của dự án).

## 2. Đã kiểm tra thật bằng cách nào / chưa kiểm tra

### 2.1 Đã kiểm tra (theo `mobile/PLAN.md` và ghi chú chủ dự án)
Mọi bài test chạy trên **database tạm** (dựng từ `schema.sql` đã đổi tên DB, xóa sau khi xong) hoặc container thử nghiệm riêng; **không ghi vào `clothing_store` thật, không đụng Keycloak thật**. Mã kiểm tra nằm ở thư mục tạm ngoài repo.
- API backend trên MySQL thật (DB tạm): lọc/sắp xếp, đơn hàng + hoàn kho + vận đơn + hàng loạt, gợi ý/liên quan/yêu thích/đánh giá, phân quyền.
- Đặt hàng đồng thời: tồn 5 + 20 yêu cầu = đúng 5 đơn, kho về 0; 3 người cùng đặt 3 luôn đúng 1 thành công; 30 đơn hai sản phẩm thứ tự ngược nhau không deadlock; mã còn 1 lượt + 3 người = đúng 1 người. Lỗi bấm đặt hai lần tạo hai đơn đã sửa (12/12 lần chỉ 1 đơn).
- Keycloak 26.8.1 thật trong container thử nghiệm riêng: script `setup:keycloak` + API đăng ký 67 kiểm tra; giao diện đăng nhập/đăng ký trong app (bản web) 32 bước.
- Web CMS trên Edge + Vite (chế độ `VITE_AUTH_DISABLED`): Đơn hàng 40 bước, các trang mới 75 bước, Tổng quan/Sản phẩm/Đánh giá 24 bước; không tràn ngang ở 390/768/1024 px; `vite build` thành công.
- Mobile: bản web của app (react-native-web, trên Edge) nối backend + DB tạm: 30 + 40 + 37 + 45 bước tùy giai đoạn; `npx expo export` Android + iOS; `expo-doctor` 20/20.
- Docker Compose (project và cổng riêng, đã dọn): build 3 image, MySQL tự nạp schema, API/ảnh/đặt hàng, nginx phục vụ CMS, dữ liệu còn sau restart và sau `down` + `up`.

### 2.2 CHƯA kiểm tra thật
- **Điện thoại thật / Expo Go**: chưa thử lần nào (bảng lọc trượt, `Share`, AsyncStorage, `Alert` native, nút Back Android, bàn phím/vùng an toàn, trình duyệt hệ thống trả về app qua `exp://`/`hfarm://`, SecureStore, HTTP tới IP LAN, ảnh thật, nhãn tab có bị cụt chữ không).
- `npm run setup:keycloak` trên **Keycloak thật** của chủ dự án (chưa chạy; trạng thái Direct access grants của `hfarm-mobile` trên đó: Chưa xác minh) và đăng ký trong app với Keycloak thật.
- CMS đăng nhập Keycloak thật với đủ cả hai vai trò (menu theo vai trò staff/admin chỉ thử ở chế độ dev); Safari/Firefox (chỉ Edge).
- Quên mật khẩu, xác minh email, gửi email (cần SMTP của realm); brute-force detection của realm.
- Docker ở chế độ Keycloak; nạp dữ liệu bằng `mysqldump`; hiệu năng với nhiều sản phẩm/đơn/đánh giá/mã giảm giá (bảng Mã giảm giá lọc phía trình duyệt trên toàn bộ danh sách).
- Các lệnh trong RUNBOOK ghi "Chưa xác minh" (tên service MySQL, luật `netsh`, tạo lại container Keycloak).

### 2.3 Kiểm tra bổ sung khi viết tài liệu (2026-11-18, chỉ đọc)
- Keycloak đang chạy của dự án: có realm `hfarm`, issuer `http://localhost:8080/realms/hfarm`, hỗ trợ PKCE S256 và `prompt=create`; mount volume `hfarm_keycloak` -> `/opt/keycloak/data`.
- Bằng GET trang `/auth` (không đăng nhập): client `hfarm-web` và `hfarm-mobile` đều **bắt PKCE**; `http://localhost:5173/` (web) và `hfarm://login` (mobile) được chấp nhận làm redirect URI; `exp://` với IP lạ bị từ chối.
- Không kiểm tra được cấu hình chi tiết client (cần đăng nhập trang quản trị Keycloak bằng `admin` của realm master).

## 3. Hạn chế đã biết và nợ kỹ thuật (đối chiếu code)

**Kiểm thử/chất lượng**
- **Chưa có test nào trong repo** (không có script `test`, không có thư mục test); bộ test đã dùng nằm ngoài repo.
- Chưa có lint/typecheck cấu hình (dự án là JavaScript; `mobile/AGENTS.md` đã ghi rõ; `npx expo lint` tự cài eslint và sửa `package.json` nên đừng chạy).
- Chưa có `database/migrations/` và không có seed: muốn có dữ liệu phải nhập qua CMS.

**Thanh toán/đơn hàng**
- Thông tin chuyển khoản trong `mobile/src/utils/bankConfig.js` là **giả**; backend chưa lưu tài khoản ngân hàng của cửa hàng.
- **Chưa có thanh toán online** (`ONLINE` được backend chấp nhận nhưng app không cho chọn, không có cổng); chuyển khoản chưa có bước xác nhận đã nhận tiền: đơn sang `COMPLETED` thì tự đánh dấu `PAID` cho mọi phương thức. `payments.provider`/`transaction_code` chưa được dùng.
- Giỏ **không giữ chỗ** hàng (chỉ trừ lúc đặt); đặt bằng `items` trong body không có khóa chống gửi trùng.
- **Hủy/hoàn trả không hoàn lại lượt dùng mã giảm giá** (`used_count`, `coupon_usages` giữ nguyên) - suy ra từ `changeOrderStatus`.
- Phí ship cố định trong code (30.000 ₫, miễn phí từ 500.000 ₫), ngưỡng "sắp hết hàng" cố định <= 5; chưa cấu hình được ở CMS. `shipments.status` không chuyển `RETURNED` khi hoàn trả.
- Chưa có đổi trả từ app (khách chỉ hủy được đơn `PENDING`), chưa có thông báo đẩy (app chỉ tải lại khi mở màn/kéo làm mới).

**Xác thực/bảo mật** (chi tiết: [ARCHITECTURE.md](ARCHITECTURE.md) mục 7)
- Theme đăng nhập Keycloak mang thương hiệu HFarm **chưa làm** (CMS vẫn dùng trang Keycloak mặc định; chưa hỏi chủ dự án có muốn không).
- Quên mật khẩu và xác minh email cần SMTP của realm; đăng ký chưa có CAPTCHA.
- Direct access grants (password grant) cho `hfarm-mobile`; backend không kiểm tra `aud`/`azp`; backend dùng MySQL `root`; chưa có `helmet`, `trust proxy`; giới hạn tần suất chỉ cho đăng ký và nằm trong bộ nhớ.
- Docker mặc định ở chế độ dev (ai gọi API cũng là admin); mật khẩu root MySQL mặc định nằm trong `docker-compose.yml`.

**Tài liệu/cấu hình lệch**
- Đã chỉnh lại (2026-11-18): `backend/.env.example` có `PUBLIC_URL` (comment); `mobile/PLAN.md` (đầu file, mục "Phát hiện về backend", mục seed), `mobile/AGENTS.md` và mục "Cấu trúc" của `mobile/README.md` đã khớp code. Phần mô tả từng giai đoạn trong `PLAN.md` vẫn là lịch sử lúc đó (ví dụ GĐ1 còn ghi chưa làm Keycloak).
- `database/schema.sql`: `reviews.order_item_id` không có UNIQUE (chống trùng chỉ ở code); `v_order_summary` không được dùng.
- Một số thông báo lỗi còn tên cột tiếng Anh (`Thiếu recipient_name`, `Thiếu code`...); app đã kiểm tra trước nên ít gặp.

## 4. Ý tưởng làm tiếp (theo ưu tiên)

1. **Thử trên điện thoại thật** (Expo Go) toàn bộ luồng: duyệt, tìm kiếm, lọc, giỏ, đặt hàng, đăng nhập/đăng ký, đánh giá; ghi lại lỗi vào `mobile/PLAN.md`.
2. **Đưa test vào repo**: test tích hợp backend trên database tạm (đặt hàng đồng thời, hoàn kho, phân quyền), test logic thuần của mobile; thêm script `test`.
3. **Chốt chiến lược đăng nhập app**: quyết định giữ hay bỏ Direct access grants; kiểm tra brute-force detection, cấu hình SMTP + xác minh email + quên mật khẩu; cân nhắc kiểm tra `aud`/`azp` ở `auth.js`; tài khoản MySQL quyền tối thiểu; `helmet`, `trust proxy`.
4. **Thanh toán thật**: tài khoản ngân hàng thật hoặc lấy từ API/CMS, bước xác nhận chuyển khoản, cổng thanh toán online; hoàn lượt mã giảm giá khi hủy/hoàn trả.
5. **Hạ tầng dữ liệu**: tạo `database/migrations/` + seed demo (không có dữ liệu thật), sao lưu định kỳ MySQL và volume `hfarm_keycloak`.
6. **Trải nghiệm**: theme đăng nhập Keycloak mang thương hiệu HFarm, thông báo đẩy khi đơn đổi trạng thái, đổi trả từ app, giữ chỗ hàng trong giỏ, cấu hình phí ship/ngưỡng tồn ở CMS.
7. **Vận hành**: thử Docker chế độ Keycloak (và ghi lại cấu hình đúng vào RUNBOOK), CI chạy build + test, thử CMS trên Safari/Firefox, đo hiệu năng với dữ liệu lớn.
