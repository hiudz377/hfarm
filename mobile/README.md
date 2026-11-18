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

Mặc định app chạy ở **chế độ dev** (`EXPO_PUBLIC_AUTH_MODE=dev`): trong `backend/.env` giữ `AUTH_ENABLED=false`, app gửi
header `X-Dev-Role: customer` nên có thể chạy cùng lúc với web CMS (admin). Muốn đăng nhập thật xem mục
[Đăng nhập với Keycloak](#đăng-nhập-với-keycloak).

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
  login          Đăng nhập / Tạo tài khoản (modal; cũng là đích của redirect URI)
  profile        sửa họ tên / SĐT           addresses    sổ địa chỉ
  address-form   thêm / sửa địa chỉ (modal; ?id= để sửa, ?from=checkout khi mở từ thanh toán)
src/api/         client.js (axios duy nhất), products, cart, orders (quote, đặt, danh sách, chi tiết, hủy), addresses, me
src/auth/        AuthProvider (React: trạng thái đăng nhập), keycloak.js (lõi OAuth: đăng nhập, làm mới token, đăng xuất),
                 storage.js (lưu refresh token bằng expo-secure-store)
src/components/  LoginPanel (màn Đăng nhập / Tạo tài khoản), Button, Card, Chip, EmptyState, Loading, Photo (expo-image), Field, KeyboardView, QuantityStepper,
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
## Đăng nhập với Keycloak
Chế độ `keycloak` thay đăng nhập dev bằng đăng nhập thật. **Đăng nhập và đăng ký diễn ra ngay trong app** (form email + mật khẩu), không nhảy sang trình duyệt:
đăng nhập gửi thẳng tới token endpoint của Keycloak (password grant, cần bật Direct access grants cho client `hfarm-mobile`), đăng ký đi qua `POST /api/auth/register` của backend rồi tự đăng nhập.
Cả hai bước cấu hình bằng một lệnh: `cd backend` rồi `npm run setup:keycloak -- --write-env` (xem README gốc, mục Keycloak bước 4).
Chưa chạy script thì app tự dùng luồng trình duyệt cũ (**Authorization Code + PKCE (S256)** qua Chrome Custom Tabs / ASWebAuthenticationSession), cũng là luồng dự phòng và dùng cho "Quên mật khẩu?".
- **Xem sản phẩm tự do** khi chưa đăng nhập. Thêm vào giỏ, thanh toán, tab Đơn hàng và Tài khoản yêu cầu đăng nhập
  (các tab hiện màn đăng nhập thay vì gọi API; màn thanh toán / đơn / địa chỉ bị chặn nếu mở bằng liên kết khi chưa đăng nhập).
- **Đăng nhập** / **Tạo tài khoản**: mở màn `/login` với form trong app (tab Đăng nhập / Đăng ký, hiện/ẩn mật khẩu, kiểm tra dữ liệu ngay trên máy, thông báo lỗi tiếng Việt). Tài khoản tạo từ app được gán role `customer`.
  Luồng trình duyệt dự phòng (nút "Đăng nhập bằng trình duyệt" khi client chưa bật Direct access grants, "Tạo tài khoản bằng trình duyệt" khi backend chưa bật đăng ký trong app) dùng `prompt=create` (Keycloak >= 26.1).
- **Token**: access token chỉ nằm trong bộ nhớ; **refresh token** lưu bằng `expo-secure-store` (Keychain / Keystore) nên mở lại app
  vẫn đăng nhập. Access token tự làm mới khi còn dưới 30 giây. Backend trả 401 thì app làm mới cưỡng bức và gửi lại đúng một lần;
  vẫn lỗi (hoặc Keycloak từ chối refresh token) thì xóa phiên và về màn Đăng nhập kèm thông báo "Phiên đăng nhập đã hết hạn".
  Mất mạng khi làm mới thì **giữ phiên**, không đá người dùng ra.
- **Đăng xuất**: xóa token trong máy và gửi `POST end_session_endpoint` kèm `refresh_token` để Keycloak hủy phiên
  (cookie đăng nhập trong trình duyệt cũng vô hiệu). Dữ liệu giỏ / đơn / địa chỉ của phiên cũ bị xóa khỏi bộ nhớ đệm.
- Tên và email ở tab Tài khoản lấy từ `GET /api/me` (backend đồng bộ từ token Keycloak vào bảng `users`).

### Cách chạy
1. **Keycloak**: realm `hfarm`; client `hfarm-mobile` = public client, Standard flow, bật Require PKCE (S256).
   Valid redirect URIs: `hfarm://*`, `exp://<IP-LAN>:8081`, `exp://<IP-LAN>:8081/*`. Bật cho phép tự đăng ký (Realm settings > Login > User registration).
   Keycloak phải truy cập được từ điện thoại (ví dụ Docker `-p 8080:8080`, mở cổng 8080 ở tường lửa).
2. **Backend** (`backend/.env`): `AUTH_ENABLED=true`, `KEYCLOAK_URL=http://localhost:8080` (địa chỉ mà **backend** dùng để lấy JWKS),
   `KEYCLOAK_REALM=hfarm` và `KEYCLOAK_ISSUERS` liệt kê **cả** issuer của web và của điện thoại, ví dụ
   `KEYCLOAK_ISSUERS=http://localhost:8080/realms/hfarm,http://192.168.1.18:8080/realms/hfarm`. Lý do: Keycloak ghi vào token
   đúng địa chỉ mà client dùng để lấy token, mà web dùng `localhost` còn điện thoại dùng IP LAN. Khởi động lại backend.
3. **Mobile** (`mobile/.env`): đổi `EXPO_PUBLIC_AUTH_MODE=keycloak` và điền các biến Keycloak (bảng dưới), rồi `npx expo start --clear`.
4. Mở Metro, xem dòng `[auth] Redirect URI đang dùng: ...` rồi đối chiếu với **Valid redirect URIs** của client.

| Biến | Giá trị ví dụ | Ý nghĩa |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://192.168.1.18:3000/api` | Địa chỉ backend (IP LAN) |
| `EXPO_PUBLIC_AUTH_MODE` | `dev` (mặc định) hoặc `keycloak` | `dev` chạy không cần Keycloak |
| `EXPO_PUBLIC_KEYCLOAK_URL` | `http://192.168.1.18:8080` | Keycloak mà **điện thoại** truy cập được. Quyết định issuer của token |
| `EXPO_PUBLIC_KEYCLOAK_REALM` | `hfarm` | Tên realm |
| `EXPO_PUBLIC_KEYCLOAK_CLIENT_ID` | `hfarm-mobile` | Client public dành cho app |

### Redirect URI: Expo Go và development build
App dùng `makeRedirectUri({ scheme: "hfarm", path: "login" })` và in giá trị thực tế ra console (bản dev). Hai môi trường cho kết quả khác nhau:
- **Expo Go**: `exp://<IP-máy-chạy-Expo>:8081/--/login`. Expo Go không dùng scheme `hfarm` của app mà dùng scheme `exp` của chính nó;
  IP là IP mà Metro hiển thị trong mã QR nên đổi theo Wi-Fi.
- **Development build / bản phát hành**: `hfarm://login`. Scheme `hfarm` khai trong `app.json` và gắn vào bản build,
  không phụ thuộc IP. Đổi scheme phải build lại app.

Path `login` trùng màn Đăng nhập có sẵn nên khi hệ điều hành mở app bằng liên kết này, Expo Router không báo "không tìm thấy màn hình".

### Đổi Wi-Fi thì IP đổi: sửa những chỗ nào
1. `mobile/.env`: `EXPO_PUBLIC_API_URL` và `EXPO_PUBLIC_KEYCLOAK_URL` (rồi `npx expo start --clear`).
2. `backend/.env`: `KEYCLOAK_ISSUERS` (thêm hoặc đổi issuer theo IP mới), khởi động lại backend.
3. Keycloak, client `hfarm-mobile`: **Valid redirect URIs** (`exp://<IP mới>:8081` và `exp://<IP mới>:8081/*`). Bản development build dùng `hfarm://*` nên không phải sửa.

Mẹo: đặt IP tĩnh (hoặc DHCP reservation) cho máy tính để khỏi phải sửa mỗi lần.

### Lỗi thường gặp
- **Trang Keycloak báo `Invalid parameter: redirect_uri`**: redirect URI app đang dùng chưa có trong Valid redirect URIs. Chép đúng dòng
  `[auth] Redirect URI đang dùng` vào client. Với Expo Go, IP phải là IP của Metro (máy có nhiều card mạng / VPN thì có thể khác IP Keycloak).
- **Đăng nhập được nhưng mọi API trả 401**: issuer không khớp. Backend ghi log `Token bị từ chối: issuer "..." không có trong danh sách`;
  thêm đúng issuer đó vào `KEYCLOAK_ISSUERS` (lỗi điển hình sau khi đổi IP).
- **"Không kết nối được máy chủ đăng nhập"**: điện thoại không tới được Keycloak. Thử mở `http://<IP>:8080` bằng trình duyệt trên điện thoại;
  kiểm tra cùng Wi-Fi (không phải Wi-Fi khách / bật cách ly thiết bị), tường lửa Windows cho cổng 8080, VPN đang bật, và `EXPO_PUBLIC_KEYCLOAK_URL` còn IP cũ hay chưa chạy lại với `--clear`.
- **Đăng nhập xong không quay lại app**: redirect URI sai scheme. Expo Go dùng `exp://`, development build dùng `hfarm://`. Kiểm tra `scheme` trong `app.json`.
- **Báo "Email của tài khoản này đã được dùng bởi một tài khoản khác"** (HTTP 409): bảng `users` đã có dòng cùng email từ trước (ví dụ tạo ở chế độ dev).
  Backend không tự gộp tài khoản vì email ở Keycloak có thể chưa xác minh; đổi email hoặc xử lý dòng cũ trong database.
- **Phải đăng nhập lại sau một lúc không dùng**: refresh token sống bằng phiên SSO của Keycloak (mặc định nhàn rỗi 30 phút, tối đa 10 giờ).
  Muốn lâu hơn: Keycloak > Realm settings > Sessions.
- **Bản phát hành (release) không gọi được `http://`**: Android và iOS chặn HTTP thường. Bản phát hành cần Keycloak và API qua HTTPS;
  Expo Go và development build trong mạng LAN thì dùng được HTTP.

### Chưa kiểm tra trên thiết bị thật
Giao diện và luồng OAuth đã chạy thử trên **bản web** của chính mã này với Keycloak 26.8.1 thật. Các phần chỉ có trên thiết bị chưa được thử:
trình duyệt hệ thống trả về app qua `exp://` / `hfarm://`, lưu refresh token bằng SecureStore, HTTP tới IP LAN từ điện thoại.

### Tài liệu đã dùng (Expo SDK 58)
- https://docs.expo.dev/versions/v58.0.0/sdk/auth-session/ , https://docs.expo.dev/versions/v58.0.0/sdk/webbrowser/ , https://docs.expo.dev/versions/v58.0.0/sdk/securestore/
- https://docs.expo.dev/router/advanced/protected/ (route được bảo vệ: `Stack.Protected`)
- Keycloak 26.1.0 release notes, mục "Support for prompt=create"
