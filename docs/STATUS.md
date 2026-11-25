# Tình trạng dự án HFarm

> Cập nhật: 2026-11-25 (sau commit `73bdda4`; theme đăng nhập Keycloak, logo/icon/màn hình chờ mới và đợt "liên hệ, chính sách, hướng dẫn chọn size" CHƯA commit). **Khi xong một tính năng hoặc kiểm tra thêm điều gì, sửa file này trước khi báo xong.**
> Nguồn: code hiện tại + nhật ký kiểm tra trong `mobile/PLAN.md` + ghi chú của chủ dự án. Phần "đã kiểm tra" do các phiên trước báo; tài liệu này không chạy lại chúng (trừ mục 2.3).

## 1. Đã làm (theo module)

### Database (`database/schema.sql`)
- 22 bảng + 2 view (`v_product_stock`, `v_order_summary`), ràng buộc CHECK/UNIQUE/FK, dữ liệu mẫu 6 size, 5 màu, 4 danh mục. Có các ràng buộc chống dữ liệu sai (tồn kho không âm, giá không âm, SKU/mã đơn/mã vận đơn duy nhất).
- `database/migrations/`: `001_payment_shipping.sql` (hạn trả đơn, `bank_transactions`, `shipping_zones` + vùng mặc định, `shipment_events`), `002_banners.sql`. **Phải áp dụng lên database đang dùng** (RUNBOOK mục 8); chưa áp dụng lên `clothing_store` thật. Chưa có seed.

### Backend (`backend/`)
- Xác thực Keycloak (JWKS, nhiều issuer, đồng bộ bảng `users` theo `sub`, 401/403/503 phân biệt) + chế độ dev `X-Dev-Role`; phân quyền admin/staff ở backend.
- Danh mục công khai: lọc, sắp xếp, phân trang, gợi ý tìm kiếm, sản phẩm liên quan, size chữ/số, `?in_use=1`.
- Giỏ hàng, báo giá (`/orders/quote`), đặt hàng trong transaction (khóa kho, mã giảm giá, phí ship, tự thử lại khi trùng mã đơn, khóa giỏ chống đặt hai lần), hủy/hoàn trả có hoàn kho, xử lý hàng loạt, mã vận đơn tự sinh.
- Hồ sơ + sổ địa chỉ, yêu thích, đánh giá (khách gửi `PENDING`, CMS duyệt), mã giảm giá, thống kê/doanh thu, nhập/xuất/điều chỉnh kho + lịch sử, tải ảnh.
- Đăng ký ngay trong app qua Keycloak Admin API (client `hfarm-backend`), giới hạn tần suất, script `npm run setup:keycloak`.
- **Thanh toán chuyển khoản VietQR** (2026-11-24): mã QR tự sinh tại server (chuẩn EMVCo/NAPAS, không gọi dịch vụ ngoài), tài khoản nhận tiền đọc từ `.env`; hạn trả `PAYMENT_HOLD_MINUTES` + tác vụ mỗi phút tự hủy đơn quá hạn (hoàn kho + hoàn lượt mã giảm giá); webhook SePay (chống trùng, cộng dồn chuyển thiếu, nhận diện chuyển dư/trùng/đơn đã hủy/sai tài khoản); nhân viên xác nhận tay; danh sách giao dịch cần xử lý.
- **Giao hàng tự quản**: phí + số ngày giao theo vùng (`shipping_zones`), báo giá theo địa chỉ, hành trình (mốc đổi trạng thái + mốc nhân viên ghi + mốc đã nhận tiền), tra cứu công khai theo mã vận đơn (che tên, không lộ SĐT/địa chỉ).
- Banner trang chủ (CRUD, hẹn giờ), `products?on_sale=1`, `categories.thumbnail`.
- **Sửa lỗi cũ** trong `services/orders.js`: đơn hủy/hoàn trả giờ trả lại lượt dùng mã giảm giá (trước đó mất vĩnh viễn). Các thay đổi khác ở `orders.js` (phí ship theo vùng, hạn trả, cờ `requireUnpaid`) KHÔNG đụng logic trừ kho/hoàn kho.

### Web CMS (`web/`)
- Đăng nhập Keycloak (keycloak-js, PKCE S256), làm mới token, xử lý 401/403, menu + route theo vai trò.
- 12 trang: Tổng quan (KPI, biểu đồ, "Cần xử lý"), Sản phẩm (+ngăn biến thể/kho/ảnh), Đơn hàng (5 tab, xử lý hàng loạt, chi tiết, **xác nhận đã nhận tiền, hành trình, in phiếu có mã QR**), Đánh giá (duyệt), Khách hàng, Mã giảm giá, Danh mục, Thương hiệu, Size & Màu, Kho hàng, **Vận chuyển (vùng ship), Giao dịch ngân hàng, Banner**. Giao diện tiếng Việt, tiền `1.250.000 ₫`.

### Mobile (`mobile/`)
- Expo SDK 58 + Expo Router + React Query. Tab **Trang chủ** (banner từ CMS hoặc mặc định, ưu đãi giao hàng/thanh toán lấy từ cấu hình thật, ô danh mục, dải Hàng mới về / Bán chạy / Đang giảm giá, khung chờ), Cửa hàng (tìm kiếm + gợi ý + lịch sử, bảng lọc/sắp xếp, nhận tham số từ trang chủ), Giỏ hàng (mã giảm giá), Đơn hàng (lọc, chi tiết, hủy, **theo dõi giao hàng**), Tài khoản; chi tiết sản phẩm (ảnh, thông tin giao hàng, đánh giá, liên quan, chia sẻ, thanh "Đã thêm vào giỏ"), thanh toán (COD / **chuyển khoản QR**, phí ship + ngày giao theo địa chỉ), **mã QR + đếm ngược + tự cập nhật khi tiền về**, địa chỉ, yêu thích, gửi đánh giá. Giao diện mới: xanh rừng + nền kem, header trắng.
- Đăng nhập/đăng ký trong app (form email + mật khẩu), luồng trình duyệt dự phòng, refresh token trong SecureStore, chế độ dev.
- **Hỗ trợ khách hàng, chính sách, hướng dẫn chọn size (2026-11-25)**: màn **Liên hệ & hỗ trợ** (`/contact`: tên, địa chỉ, giờ mở cửa, nút Gọi / Nhắn Zalo / Gửi email) và 3 trang chính sách (`/policy/returns|privacy|terms`) xem được cả khi chưa đăng nhập; mục "Hỗ trợ" ở tab Tài khoản + số phiên bản; dòng "Liên hệ & chính sách" ở lời mời đăng nhập; dòng đồng ý Điều khoản + Chính sách bảo mật ở tab Đăng ký; khối **"Cần hỗ trợ?"** cuối chi tiết đơn (lời nhắn theo trạng thái: đơn Hoàn thành nói về đổi trả trong N ngày, đơn đã xác nhận giải thích vì sao không tự hủy được; email có sẵn mã đơn). **Hướng dẫn chọn size** (modal từ trang sản phẩm, tô dòng size đang chọn): ô nhập chiều cao/cân nặng gợi ý size, bảng size chữ (cao, nặng, ngực, eo, mông), bảng size số (quần, inch -> cm), cách đo. Backend thêm `GET /api/store` (công khai, chỉ đọc `STORE_*` + `RETURN_DAYS` trong `.env`, không đụng database) nên đổi số điện thoại không phải build lại app.

### Nhận diện thương hiệu (logo, icon, màn hình chờ; 2026-11-25)
- Logo HFarm (biểu tượng HF + dây leo + chữ "HFarm" + "THỜI TRANG") lấy từ ảnh thiết kế 1408x768 của chủ dự án: tách khỏi nền giấy kem thành PNG trong suốt, phóng 3 lần + làm nét; ảnh gốc nhỏ nên **chi tiết dây leo hơi mềm khi phóng to** (cần SVG hoặc ảnh lớn hơn nếu muốn sắc nét tuyệt đối). Nền kem chuẩn của logo: `#F5F5EE` (`colors.splash` trong `mobile/src/utils/theme.js`, `backgroundColor` của plugin splash trong `mobile/app.json`, nền thẻ logo ở `web/src/styles.css`).
- **Mobile**: `assets/icon.png` (biểu tượng trên nền kem), icon thích ứng Android (`android-icon-*.png`, nền kem `#F5F5EE`, lớp đơn sắc trắng), `favicon.png`, `splash-icon.png` (iOS) + `splash-icon-android.png` (nhỏ hơn vì Android 12+ cắt hình tròn), 4 bản logo dùng trong app `assets/logo-{full,compact,mark,wordmark}.png` qua component `BrandLogo`. Plugin `expo-splash-screen` (gói mới, cài bằng `npx expo install`) cấu hình trong `app.json`. Màn chờ trong app `BrandSplash` (logo giữa màn hình, nền kem) hiện tối thiểu 1,2 giây từ lúc mở app rồi mới vào (hằng số `SPLASH_MIN_MS` trong `src/app/_layout.js`). Logo cũng thay biểu tượng lá + chữ ở đầu Trang chủ, màn đăng nhập/đăng ký và lời mời đăng nhập ở các tab.
- **Web CMS**: thanh bên có thẻ nền kem chứa logo (thu gọn thì còn biểu tượng), `web/public/favicon.png`, `logo-compact.png`, `logo-mark.png` (đã xóa `favicon.svg` cũ). **Theme Keycloak**: `resources/img/logo.png` (ô kem bo góc) + `favicon.ico` mới (đã xóa `logo.svg`); `hfarm.css` trỏ tới `logo.png`.

### Hạ tầng
- `docker-compose.yml` (MySQL riêng + backend + nginx CMS), Dockerfile backend/web, `.env.example` cho compose.
- Keycloak 26.8.1 chạy trong container `keycloak-hfarm` với volume `hfarm_keycloak` (không nằm trong compose của dự án).
- **Theme đăng nhập Keycloak `hfarm`** (`keycloak/themes/hfarm/login/`, 2026-11-24): kế thừa `keycloak.v2`, xanh rừng + nền kem + logo lá, bo góc, nút/ô nhập/thông báo cùng tông với app, gọn trên điện thoại, luôn sáng (không theo chế độ tối của hệ điều hành), tiếng Việt khi realm bật Internationalization. Chỉ phần login (chưa email, account console). Cách cài + chọn: `docs/RUNBOOK.md` mục 2.

## 2. Đã kiểm tra thật bằng cách nào / chưa kiểm tra

### 2.1 Đã kiểm tra (theo `mobile/PLAN.md` và ghi chú chủ dự án)
Mọi bài test chạy trên **database tạm** (dựng từ `schema.sql` đã đổi tên DB, xóa sau khi xong) hoặc container thử nghiệm riêng; **không ghi vào `clothing_store` thật, không đụng Keycloak thật**. Mã kiểm tra nằm ở thư mục tạm ngoài repo.
- API backend trên MySQL thật (DB tạm): lọc/sắp xếp, đơn hàng + hoàn kho + vận đơn + hàng loạt, gợi ý/liên quan/yêu thích/đánh giá, phân quyền.
- Đặt hàng đồng thời: tồn 5 + 20 yêu cầu = đúng 5 đơn, kho về 0; 3 người cùng đặt 3 luôn đúng 1 thành công; 30 đơn hai sản phẩm thứ tự ngược nhau không deadlock; mã còn 1 lượt + 3 người = đúng 1 người. Lỗi bấm đặt hai lần tạo hai đơn đã sửa (12/12 lần chỉ 1 đơn).
- Keycloak 26.8.1 thật trong container thử nghiệm riêng: script `setup:keycloak` + API đăng ký 67 kiểm tra; giao diện đăng nhập/đăng ký trong app (bản web) 32 bước.
- Web CMS trên Edge + Vite (chế độ `VITE_AUTH_DISABLED`): Đơn hàng 40 bước, các trang mới 75 bước, Tổng quan/Sản phẩm/Đánh giá 24 bước; không tràn ngang ở 390/768/1024 px; `vite build` thành công.
- Mobile: bản web của app (react-native-web, trên Edge) nối backend + DB tạm: 30 + 40 + 37 + 45 bước tùy giai đoạn; `npx expo export` Android + iOS; `expo-doctor` 20/20.
- Docker Compose (project và cổng riêng, đã dọn): build 3 image, MySQL tự nạp schema, API/ảnh/đặt hàng, nginx phục vụ CMS, dữ liệu còn sau restart và sau `down` + `up`.

- **Đợt 2026-11-24 (thanh toán QR + giao hàng + giao diện)**, đều trên database tạm `hfarm_scratch_*` + backend cổng riêng, không đụng `clothing_store`:
  - Backend 125 bước (Node, backend thật + MySQL thật): thiếu migration -> không khởi động; tắt chuyển khoản khi thiếu cấu hình; vùng ship (khớp "TP. Hà Nội" = "Hà Nội", chặn trùng tỉnh, quyền staff/admin/khách); VietQR: giải mã ẢNH QR rồi kiểm tra từng trường TLV, CRC16, số tiền, mã đơn; webhook (sai khóa, tiền ra, thiếu/bù/dư/trùng, đơn đã hủy, sai tài khoản, đơn COD, 6 webhook trùng đồng thời chỉ 1 thắng); tự hủy quá hạn (hoàn kho + hoàn lượt mã, không hủy đơn đã trả/đã xác nhận, chốt `requireUnpaid`); xác nhận tay; hành trình + tra cứu công khai (không lộ dữ liệu, giới hạn tần suất); banner; `on_sale`; hồi quy kho. Đã thử phá code cố ý (sai CRC, bỏ chốt `requireUnpaid`) để chắc bài test bắt được lỗi: lần đầu bỏ sót chốt `requireUnpaid` nên đã bổ sung bước kiểm tra riêng.
  - CMS 26 bước (Edge + Vite, `VITE_AUTH_DISABLED`): tạo vùng ship qua giao diện, xử lý giao dịch ngân hàng, thêm banner (tải ảnh), xác nhận đã nhận tiền, ghi hành trình, in phiếu (QR quét ra đúng mã vận đơn, dòng "Thu hộ (COD)" đúng số tiền), không tràn ngang ở 390/768 px. `vite build` thành công.
  - App 58 bước (bản web trên Edge 390x844, backend + DB tạm): trang chủ (banner mặc định và từ CMS, nhãn Mới/-%, danh mục, dải sản phẩm), bấm banner -> Cửa hàng lọc đúng, thêm giỏ không dùng hộp thoại, phí ship đổi theo địa chỉ (TP.HCM 30.000 ₫, Hà Nội miễn phí), đặt đơn chuyển khoản -> QR trên màn hình quét ra đúng payload, đếm ngược, nút Chép (đối chiếu clipboard), webhook giả lập -> màn tự chuyển "Đã nhận thanh toán", theo dõi đơn (mã vận đơn, mốc nhân viên, mốc đã nhận tiền), đơn quá hạn không còn QR, COD không có QR, không tràn ngang, không lỗi console. `npx expo export --platform android` thành công. Chụp ảnh từng màn để xem bằng mắt. Phát hiện và sửa: nhãn thanh tab bị cắt nửa chữ trên web.
  - Docker: volume MỚI tự áp dụng 2 migration (đủ bảng, vùng mặc định, tiếng Việt đúng UTF-8); project tạm đã dọn, volume Keycloak của bạn không đụng.
- **Theme đăng nhập Keycloak (2026-11-24)**, trên Keycloak 26.8.1 THẬT trong container thử nghiệm riêng `hfarm-kc-theme` (cổng 127.0.0.1:18082, 2 realm nhập từ JSON: `hfarm` bật Internationalization vi/en, `hfarmen` tắt giống realm thật; đã `docker rm -f` sau khi xong), Edge + Playwright, chụp ảnh và xem bằng mắt:
  - Trang đăng nhập, sai mật khẩu (viền + chữ đỏ), đăng ký (`prompt=create`), quên mật khẩu (gửi form -> thông báo xanh), trang lỗi `redirect_uri` sai, xác nhận đăng xuất: ở 1280x800 và 390x844, không tràn ngang, không lỗi console, không file 404 (logo, CSS, favicon đều nạp).
  - Đăng nhập thật bằng người dùng thử (Enter trong ô mật khẩu): Keycloak chuyển về `redirect_uri` kèm `code` + đúng `state`. Hệ điều hành bật chế độ tối: trang vẫn sáng.
  - Realm `hfarmen` (tắt Internationalization, như realm thật): chữ tiếng Anh, tên HFarm, cùng giao diện. Realm `hfarm` với trình duyệt `vi-VN`: tiếng Việt có dấu.
  - Thêm theme bằng `docker cp` khi Keycloak đang chạy (không restart) được nhận ngay; file đọc được bởi user `keycloak`.
  - Với Keycloak THẬT của bạn: chỉ `docker cp` theme vào container `keycloak-hfarm` và GET trang `/auth` để xác nhận realm vẫn dùng `keycloak.v2` (chưa chọn theme, vì cần quyền quản trị). Không đổi realm, client, người dùng.

#### Logo / icon / màn hình chờ (2026-11-25)
- Xem ảnh logo tách nền trên nền kem, trắng và xanh đậm (không viền, không đốm giấy). Bản web của app (Expo web, Edge, 390x844) chụp và xem: màn chờ (logo giữa màn hình + vòng quay), đầu Trang chủ, lời mời đăng nhập ở tab Giỏ hàng, màn `/login`; không file ảnh 404. CMS (Vite, chế độ dev, Edge): thanh bên mở rộng (1280px), thu gọn bằng nút, màn 390px; không tràn ngang, không ảnh 404, favicon nạp được. `npx expo export --platform android` biên dịch được với plugin splash.
- `npx expo-doctor` báo 1 mục chưa đạt: lệch phiên bản vá của `expo`, `expo-router`, `expo-auth-session`, `expo-web-browser` (có sẵn từ trước, không do đợt này; chưa nâng cấp).

#### Liên hệ, chính sách, hướng dẫn chọn size (2026-11-25)
Backend + MySQL THẬT trên database tạm `hfarm_scratch_support` (đã `DROP`, `clothing_store` không đụng), bản web của app trên Edge 390x844, chụp ảnh và xem bằng mắt:
- Logic thuần 240 bước (`storeConfig`: làm sạch số/email, cắt độ dài, `RETURN_DAYS` hợp lệ/không; route `GET /api/store` chỉ trả 7 trường, không lộ `BANK_*`/khóa webhook, đọc `.env` mỗi lần gọi; `suggestSize` và bảng size đơn điệu; 3 chính sách không trùng khóa React, số ngày đổi trả theo cấu hình, không có SĐT/email thật) + 12 bước `contact.js` (URL `tel:`/Zalo/`mailto:` đúng, ký tự lạ bị loại, không mở được thì hiện `Alert` kèm số, không ném lỗi).
- Giao diện 119 bước khi đã đăng nhập (chế độ dev): mục Hỗ trợ + số phiên bản ở Tài khoản; màn Liên hệ (tên, địa chỉ, giờ, 3 nút; nút Gọi/Zalo/Email truyền đúng số/URL, email có tiêu đề + nội dung kèm mã đơn); 3 chính sách (mở bằng liên kết và bằng URL, không tràn ngang ở 390px); `/policy/constructor`, `__proto__`, `toString`, slug lạ không làm sập màn; trang sản phẩm -> "Hướng dẫn chọn size" tô đúng dòng size đang chọn, gợi ý 165cm/55kg -> M, 150/40 -> XS, nhập sai và quá khổ đều có thông báo; chi tiết đơn Chờ xác nhận / Hoàn thành / Đã hủy / Đã xác nhận có lời nhắn đúng trạng thái; backend chưa đặt `STORE_*` (màn báo chưa cập nhật, không nút nào, mặc định 7 ngày); backend tắt (báo lỗi + nút Thử lại, chính sách vẫn đọc được, bấm Thử lại khi backend sống lại thì hiện nút).
- Giao diện 20 bước khi CHƯA đăng nhập (chế độ Keycloak, không có phiên): lời mời đăng nhập -> "Liên hệ & chính sách" -> Liên hệ và Chính sách bảo mật mở được; tab Đăng ký có dòng đồng ý điều khoản (2 liên kết mở đúng trang, bấm Back quay lại form), tab Đăng nhập không có; `/policy/*` và `/contact` mở thẳng bằng URL được; `/order/1` vẫn bị chặn.
- `npx expo export --platform android` từ thư mục `mobile` thật: biên dịch được (bundle Hermes 3,6 MB).
- Lỗi thật đã bắt và sửa: `getPolicy('constructor')` làm sập màn (xem `mobile/PLAN.md` 4.14). Một lần chạy có 1 bước đọc chữ ở màn Liên hệ báo lỗi chập chờn (ảnh chụp cùng lúc vẫn đúng, các lần sau đạt); bài test chờ dữ liệu `/api/store` về rồi mới đọc, nên coi là lỗi thời điểm đọc của test, không phải lỗi app.

### 2.2 CHƯA kiểm tra thật
- **Liên hệ/chính sách/hướng dẫn size trên điện thoại thật**: bấm Gọi/Zalo/Email có mở đúng ứng dụng không (Android 11+ trên máy không có SIM, chưa cài Zalo), bàn phím số ở ô chiều cao/cân nặng, modal Hướng dẫn size và chính sách mở từ modal Đăng nhập trên native, bố cục bảng size ở màn nhỏ hơn 390px hoặc chữ hệ thống phóng to. Test web chỉ bắt được URL mà app gửi tới `Linking`.
- **Icon, màn hình chờ gốc (`expo-splash-screen`) trên thiết bị/bản build thật**: chưa dựng bản build nào. Expo Go chỉ hiện icon app (không hiện splash gốc), chỉ màn `BrandSplash` trong app hiện logo đầy đủ. Kích thước splash Android 12+ (logo bị cắt hình tròn, `imageWidth` 288) và iOS (`imageWidth` 240) tính theo tài liệu Expo, chưa nhìn trên máy; icon thích ứng Android chưa thử với các kiểu mặt nạ của hãng. Logo mới trên trang đăng nhập Keycloak chưa xem (theme chưa chọn trong realm thật).
- **Điện thoại thật / Expo Go**: chưa thử lần nào (bảng lọc trượt, `Share`, AsyncStorage, `Alert` native, nút Back Android, bàn phím/vùng an toàn, trình duyệt hệ thống trả về app qua `exp://`/`hfarm://`, SecureStore, HTTP tới IP LAN, ảnh thật, nhãn tab có bị cụt chữ không).
- `npm run setup:keycloak` trên **Keycloak thật** của chủ dự án (chưa chạy; trạng thái Direct access grants của `hfarm-mobile` trên đó: Chưa xác minh) và đăng ký trong app với Keycloak thật.
- CMS đăng nhập Keycloak thật với đủ cả hai vai trò (menu theo vai trò staff/admin chỉ thử ở chế độ dev); Safari/Firefox (chỉ Edge).
- Quên mật khẩu, xác minh email, gửi email (cần SMTP của realm); brute-force detection của realm.
- **Theme đăng nhập `hfarm` trên realm THẬT**: chưa chọn (cần quản trị viên làm theo RUNBOOK mục 2), nên chưa xem được trên realm `hfarm` thật; chưa xem trên điện thoại thật (trình duyệt hệ thống mở từ app, Safari iOS, Firefox) và chưa xem các trang cập nhật mật khẩu, xác minh email, OTP/WebAuthn, chọn tổ chức (chỉ dùng CSS chung nên dự kiến cùng tông nhưng chưa chụp thử).
- **Quét mã VietQR bằng app ngân hàng thật** (mới chỉ kiểm tra cấu trúc/CRC và giải mã ảnh bằng thư viện); **webhook SePay thật** (đã đối chiếu tài liệu SePay, thử bằng dữ liệu giả lập); in phiếu ra máy in; áp dụng migration lên volume Docker cũ và lên `clothing_store` thật; điện thoại thật cho giao diện mới (cuộn banner, thanh tab, bàn phím, sao chép bằng clipboard, hiệu ứng).
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
- Tài khoản ngân hàng đặt trong `backend/.env` (đã bỏ thông tin giả khỏi app). Chưa có cổng thanh toán thẻ/ví (`ONLINE` backend chấp nhận nhưng app không cho chọn).
- Đơn chuyển khoản chưa nhận tiền mà nhân viên cho giao rồi bấm hoàn tất vẫn bị `changeOrderStatus` đánh dấu `PAID` (áp dụng cho mọi phương thức): CMS chỉ cảnh báo, chưa chặn. Chưa có hoàn tiền tự động (khoản dư/trùng/quá hạn nhân viên hoàn bằng app ngân hàng rồi bấm "Đã xử lý").
- Webhook chỉ định dạng SePay, xác thực bằng khóa API (chưa có HMAC); khách chuyển khoản không có mã đơn trong nội dung thì phải nhân viên đối soát tay. Tác vụ tự hủy đơn quá hạn chạy trong tiến trình backend (chạy nhiều bản backend vẫn an toàn nhờ khóa dòng nhưng chưa thử).
- Giỏ **không giữ chỗ** hàng (chỉ trừ lúc đặt); đặt bằng `items` trong body không có khóa chống gửi trùng. Đơn chuyển khoản giữ hàng tới hết hạn trả (mặc định 24 giờ) dù khách bỏ.
- (Đã sửa 2026-11-24) hủy/hoàn trả đã hoàn lại lượt dùng mã giảm giá; phí ship nay theo vùng ở CMS. Còn lại: ngưỡng "sắp hết hàng" cố định <= 5 (chưa cấu hình được); `shipments.status` không chuyển `RETURNED` khi hoàn trả; vùng ship khớp theo TÊN tỉnh người dùng gõ (địa chỉ là chữ tự do), nhập sai chính tả sẽ rơi vào vùng mặc định.
- Giao hàng tự quản: chưa nối GHN/GHTK (mã vận đơn tự sinh, đơn vị vận chuyển do nhân viên nhập), thời gian giao là ước tính theo vùng chứ không phải cam kết, chưa có trang web tra cứu cho người ngoài (chỉ có API `/api/tracking/:code`), tem in chưa thử ra giấy.
- Giao diện mobile: logo/icon/màn chờ đã dùng logo HFarm (chất lượng bị giới hạn bởi ảnh gốc nhỏ, xem mục Nhận diện thương hiệu); màn chờ nền kem phẳng (không có vân giấy như ảnh thiết kế); chưa có font riêng, chưa có chế độ tối; banner/ảnh sản phẩm cần ảnh thật tỉ lệ đúng (banner 2:1, sản phẩm 3:4).
- Chưa có thông báo đẩy (app chỉ tải lại khi mở màn/kéo làm mới). **Đổi trả mới chỉ ở mức liên hệ** (Gọi / Zalo / email có sẵn mã đơn): chưa có biểu mẫu "yêu cầu đổi trả" trong app, chưa có bảng/route lưu yêu cầu, nhân viên không thấy yêu cầu trong CMS; khách vẫn chỉ tự hủy được đơn `PENDING`.
- **Chính sách và bảng size là BẢN NHÁP MẪU** (`mobile/src/content/policies.js`, `sizeGuide.js`): do đội phát triển soạn theo cách app đang chạy, không phải tư vấn pháp lý. Chủ cửa hàng phải đọc, sửa cho đúng (số ngày đổi trả có `RETURN_DAYS`, còn ai trả phí vận chuyển, thời gian hoàn tiền...) và nên nhờ người am hiểu pháp luật xem trước khi phát hành. Bảng size là số đo tham khảo thông dụng, KHÔNG phải số đo thật của hàng HFarm (hàm gợi ý chọn size lớn hơn trong hai kết quả theo cân nặng và chiều cao). Chính sách bảo mật phải cập nhật khi thêm Sentry/Firebase/quảng cáo/vị trí/thông báo đẩy/thanh toán thẻ, và khi chạy HTTPS thật (hiện chưa khẳng định "mã hóa đường truyền").
- **Chưa có "Xóa tài khoản" trong app** (Apple và Google đều yêu cầu khi app cho tạo tài khoản): chính sách bảo mật hiện hướng dẫn liên hệ cửa hàng để xóa dữ liệu. Chưa có URL chính sách công khai (cần tên miền): bản trong app chỉ đáp ứng phần hiển thị trong ứng dụng.
- Thông tin liên hệ do backend trả (`STORE_*`): chưa đặt trong `backend/.env` thì màn Liên hệ báo "chưa cập nhật" và không có nút nào; Docker Compose truyền sẵn các biến này nhưng mặc định để trống.

**Xác thực/bảo mật** (chi tiết: [ARCHITECTURE.md](ARCHITECTURE.md) mục 7)
- Theme đăng nhập Keycloak `hfarm` đã làm nhưng **chưa áp dụng vào realm thật** (cần chọn Login theme + bật tiếng Việt trong trang quản trị, RUNBOOK mục 2); container `keycloak-hfarm` bị tạo lại thì phải chép lại theme. Theme email và account console vẫn mặc định. Màu CMS (antd `#2E7D32` trong `web/src/main.jsx`) hơi khác xanh rừng `#1E5B3A` của app và theme đăng nhập.
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
4. **Đưa thanh toán QR vào chạy thật**: áp dụng migration lên `clothing_store`, điền `BANK_*` thật, quét thử bằng app ngân hàng, đăng ký SePay + bật webhook (cần địa chỉ công khai cho backend), chặn đánh dấu `PAID` khi hoàn tất đơn chuyển khoản chưa nhận tiền; sau đó mới tính cổng thẻ/ví (VNPay, MoMo, payOS).
5. **Hạ tầng dữ liệu**: tạo `database/migrations/` + seed demo (không có dữ liệu thật), sao lưu định kỳ MySQL và volume `hfarm_keycloak`.
6. **Trải nghiệm**: file logo gốc (SVG hoặc PNG lớn) để thay bản phóng từ ảnh nhỏ, ảnh sản phẩm/banner chuẩn, áp dụng theme đăng nhập Keycloak vào realm thật (+ theme email khi đã có SMTP), thông báo đẩy khi đơn đổi trạng thái (nên làm cùng email đơn hàng), xóa tài khoản trong app (bắt buộc khi lên cửa hàng ứng dụng), biểu mẫu yêu cầu đổi trả trong app + màn xử lý ở CMS, giữ chỗ hàng trong giỏ, ngưỡng tồn ở CMS, nối GHN/GHTK để tính phí theo địa chỉ chuẩn + vận đơn thật, web storefront cho khách không cài app.
7. **Vận hành**: thử Docker chế độ Keycloak (và ghi lại cấu hình đúng vào RUNBOOK), CI chạy build + test, thử CMS trên Safari/Firefox, đo hiệu năng với dữ liệu lớn.
