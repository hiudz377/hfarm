# HFarm Mobile (khách hàng)

App Expo (React Native, JavaScript, Expo Router). Tiến độ và phạm vi: xem [PLAN.md](PLAN.md).

## Yêu cầu
- **Node >= 22.13** (Expo SDK 58 / React Native 0.88 không hỗ trợ Node 20). Kiểm tra: `node -v`.
- Điện thoại cài **Expo Go** (bản mới nhất trên App Store / Google Play, phải hỗ trợ SDK 58).
- Backend HFarm đang chạy và MySQL đã có dữ liệu (xem README ở thư mục gốc).

## Chạy thử
```
cd mobile
npm install
cp .env.example .env     # rồi sửa EXPO_PUBLIC_API_URL (xem bên dưới)
npx expo start
```
Quét mã QR bằng Expo Go (Android: trong app Expo Go; iPhone: bằng app Camera).

Trong `backend/.env` giữ `AUTH_ENABLED=false`. App gửi header `X-Dev-Role: customer` nên có thể chạy
cùng lúc với web CMS (admin).

## Lấy IP LAN để điền `EXPO_PUBLIC_API_URL`
Điện thoại không hiểu `localhost`. Dùng IP của máy đang chạy backend, ví dụ `http://192.168.1.10:3000/api`:
- Windows: `ipconfig`, lấy dòng **IPv4 Address** của adapter Wi-Fi.
- macOS: `ipconfig getifaddr en0`. Linux: `hostname -I`.
- Android emulator: dùng `http://10.0.2.2:3000/api`.

Sửa `.env` xong phải chạy lại với cache sạch: `npx expo start --clear` (biến `EXPO_PUBLIC_*` được nhúng lúc bundle).

## Lỗi kết nối hay gặp
- **"Không kết nối được máy chủ"**: kiểm tra theo thứ tự
  1. Backend có đang chạy không (`http://<IP>:3000/api/products` mở được trên trình duyệt của điện thoại không).
  2. **Điện thoại và máy tính khác Wi-Fi** (hoặc Wi-Fi bật cách ly thiết bị / Wi-Fi khách) - phải cùng mạng.
  3. **Tường lửa** (Windows Defender Firewall) chặn cổng 3000 hoặc Node.js: cho phép Node.js trên mạng Private,
     hoặc thêm luật cho cổng 3000.
  4. **Quên đổi `EXPO_PUBLIC_API_URL`** (còn IP mẫu, IP đổi sau khi đổi Wi-Fi) hoặc quên `--clear` sau khi sửa.
  5. VPN đang bật có thể làm IP lấy được không phải IP Wi-Fi.
- **Danh sách trống**: database chưa có sản phẩm (nhập qua web CMS), hoặc sản phẩm chưa ở trạng thái "Đang bán".
- **Ảnh không hiện**: ảnh được tải qua cùng địa chỉ với API; kiểm tra mở được `http://<IP>:3000/uploads/<tên-ảnh>`.
- **Expo Go báo SDK không tương thích**: cập nhật Expo Go lên bản mới nhất.
- **Cảnh báo "Node.js is outdated"**: nâng Node lên >= 22.13 (ví dụ `nvm install 22` rồi `nvm use 22`).

## Cấu trúc
```
src/app/         màn hình (Expo Router)
  (tabs)/        4 tab: index (cửa hàng), cart, orders, account
  product/[id]   chi tiết sản phẩm          order/[id]   chi tiết đơn hàng
  checkout       thanh toán                 order-success  đặt hàng thành công
  profile        sửa họ tên / SĐT           addresses    sổ địa chỉ
  address-form   thêm / sửa địa chỉ (modal; ?id= để sửa, ?from=checkout khi mở từ thanh toán)
src/api/         client.js (axios duy nhất), products, cart, orders (quote, đặt, danh sách, chi tiết, hủy), addresses, me
src/auth/        AuthProvider (dev: coi như đã đăng nhập; chừa chỗ Keycloak)
src/components/  Button, Card, Chip, EmptyState, Loading, Photo (expo-image), Field, KeyboardView, QuantityStepper,
                 ProductCard, CartItemRow, PriceSummary, BankInfo, OrderCard, StatusBadge, Timeline, MenuRow, AddressCard
src/utils/       config, theme, format (tiền, ngày, ảnh), queryKeys (khóa React Query dùng chung), useCart (giỏ + làm mới
                 sau đặt/hủy), useRefresh (làm mới khi focus, kéo để làm mới), useDebounce, validate (địa chỉ, hồ sơ, SĐT VN),
                 orderStatus (nhãn + màu + bộ lọc), payment, bankConfig, nav
```

Quy ước chung của mọi màn: có trạng thái **loading**, **lỗi (nút "Thử lại")** và **trống**; màn có ô nhập bọc trong
`KeyboardView` (bắt buộc có `behavior` ở cả iOS lẫn Android vì Expo mặc định edge-to-edge) và cộng `insets.bottom`
cho thanh nút cố định; ảnh luôn đi qua `Photo` (expo-image); thông báo cho người dùng bằng tiếng Việt.

## Giỏ hàng và thanh toán (GĐ2)
- Tiền (tạm tính, giảm giá, phí ship, tổng) luôn lấy từ `POST /api/orders/quote` - cùng hàm tính với `POST /api/orders`,
  nên không cần giữ phí ship ở phía app.
- **Thông tin chuyển khoản là giả định**: sửa ở `src/utils/bankConfig.js` (ngân hàng, số tài khoản, chủ tài khoản,
  tiền tố nội dung chuyển khoản). Thay bằng tài khoản thật trước khi phát hành.
- Cần ít nhất 1 sản phẩm có biến thể còn hàng để thử luồng giỏ -> thanh toán; mã giảm giá tạo qua CMS (API `/api/admin/coupons`).
- Đặt hàng sẽ trừ tồn kho thật trong database. Muốn thử mà không đụng dữ liệu thật, hãy trỏ backend vào một database khác
  (`DB_NAME` trong `backend/.env`, dựng bằng `database/schema.sql` đã đổi tên database).

## Đơn hàng và tài khoản (GĐ3)
- Danh sách đơn gọi `GET /api/orders?status=&page=&limit=`. Bộ lọc gom nhóm: **Đang giao** = đã xác nhận + đang xử lý + đang giao
  (`CONFIRMED,PROCESSING,SHIPPING`), **Đã hủy** = đã hủy + hoàn trả; nhãn trên từng thẻ luôn là trạng thái thật.
- Trạng thái đơn có thể đổi ở CMS: app tải lại khi mở lại tab/màn (và khi kéo để làm mới). Chưa có đẩy thông báo thời gian thực.
- "Hủy đơn" chỉ có khi đơn còn `PENDING`; backend hoàn kho. Nếu CMS vừa xác nhận đơn, bấm hủy sẽ báo lỗi và màn tự đổi trạng thái.
- Tài khoản: sửa họ tên + số điện thoại (`PUT /api/me`), sổ địa chỉ (thêm / sửa / xóa / đặt mặc định). Xóa địa chỉ mặc định thì
  địa chỉ mới nhất còn lại được chuyển làm mặc định.
- **Đăng xuất ở chế độ dev** không có phiên thật để xóa: nút chỉ làm mới dữ liệu tạm trong app và báo rõ như vậy.
## Keycloak (làm sau)
Chỉ cần sửa `src/auth/AuthProvider.js` (đăng nhập, lưu token bằng `expo-secure-store`) và nhánh `else` trong
interceptor của `src/api/client.js` (đã sẵn `Authorization: Bearer`). Đặt `EXPO_PUBLIC_AUTH_MODE=keycloak`
và `AUTH_ENABLED=true` ở backend; khi đó backend bỏ qua header `X-Dev-Role`.
