# Runbook HFarm (Windows)

> Hướng dẫn vận hành thực tế trên Windows 11 + PowerShell. Lệnh đã được đối chiếu với code/README; chỗ nào chưa thử thật thì có ghi "Chưa xác minh".
> `<THU_MUC_DU_AN>` = thư mục gốc dự án; đường dẫn có dấu cách (ví dụ `...\HTBanQA (1)\HTBanQA`) nên **luôn bọc `"..."` khi `cd`**.
> `<IP_MAY_TINH>` = IPv4 của máy chạy backend, cùng Wi-Fi với điện thoại. Không ghi IP/mật khẩu thật vào tài liệu hoặc Git.

## 0. Chuẩn bị một lần
- Windows: mở **PowerShell bằng quyền Administrator** (cần cho `nvm use`, `netsh`, khởi động service).
- Node: `nvm use 24.14.0` (Expo SDK 58 / React Native 0.88 cần **Node >= 22.13**). PATH mặc định của máy dev là v20.18.0, không đủ cho mobile. Backend/web chạy bằng cùng Node 24 cho đồng nhất (backend Docker dùng `node:22`).
- Docker Desktop (cho Keycloak). MySQL cài trên máy (cổng 3306) với database `clothing_store` đã có dữ liệu.
- Cài thư viện lần đầu hoặc sau khi `package.json` đổi: `npm install` trong `backend`, `web`, `mobile` (mobile dùng `npx expo install <gói>` để thêm gói).
- File cấu hình: sao chép `backend/.env.example` -> `backend/.env`, `web/.env.example` -> `web/.env`, `mobile/.env.example` -> `mobile/.env` rồi sửa (mô tả từng biến: [ARCHITECTURE.md](ARCHITECTURE.md) mục 6). Các `.env` bị `.gitignore`.
- Cảnh báo: `database/schema.sql` **XÓA SẠCH mọi bảng** rồi tạo lại. Chỉ chạy trên database trống/thử nghiệm, KHÔNG chạy trên `clothing_store` đang có dữ liệu.

## 1. Chạy từ đầu (mỗi bước một cửa sổ PowerShell quản trị)

Thứ tự bật: **Docker Desktop -> Keycloak -> MySQL -> backend -> web -> mobile**.

| # | Việc | Lệnh | Kiểm tra nhanh |
|---|---|---|---|
| 1 | Bật Docker Desktop, đợi chạy xong | (mở ứng dụng) | `docker ps` không báo lỗi |
| 2 | Bật Keycloak | `docker start keycloak-hfarm` | `curl.exe -s -o NUL -w "%{http_code}" http://localhost:8080/realms/hfarm/.well-known/openid-configuration` trả `200`; log: `docker logs --tail 20 keycloak-hfarm` |
| 3 | Bật MySQL (nếu chưa chạy) | `Get-Service *mysql*` để biết tên service, rồi `Start-Service <TEN_SERVICE>` (tên thường gặp `MySQL80`: Chưa xác minh) | `Test-NetConnection localhost -Port 3306` có `TcpTestSucceeded : True` |
| 4 | Backend | `cd "<THU_MUC_DU_AN>\backend"` rồi `nvm use 24.14.0` rồi `npm run dev` | Log `Server chạy tại http://localhost:3000`; `curl.exe http://localhost:3000/api/products?limit=1` trả JSON `{data, page, limit, total}` |
| 5 | Web CMS | `cd "<THU_MUC_DU_AN>\web"` rồi `nvm use 24.14.0` rồi `npm run dev` | Mở http://localhost:5173 -> chuyển sang trang đăng nhập Keycloak (hoặc vào thẳng CMS nếu `VITE_AUTH_DISABLED=true`) |
| 6 | Mobile | `cd "<THU_MUC_DU_AN>\mobile"` rồi `nvm use 24.14.0` rồi `node -v` (phải >= 22.13) rồi `npx expo start` | Metro hiện mã QR + `exp://<IP_MAY_TINH>:8081`; quét bằng Expo Go. Sau khi sửa `mobile/.env` dùng `npx expo start --clear` |

Ghi chú:
- Backend nối MySQL kiểu "lười": nếu MySQL chưa chạy thì backend vẫn khởi động, nhưng mọi API chạm database trả 500 `Lỗi server` (console backend in lỗi từ `mysql2`).
- Chế độ dev (không Keycloak): `backend/.env` giữ `AUTH_ENABLED=false`, `web/.env` đặt `VITE_AUTH_DISABLED=true`, `mobile/.env` giữ `EXPO_PUBLIC_AUTH_MODE=dev`; bỏ qua bước 2.
- Chế độ Keycloak: `AUTH_ENABLED=true`, `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_ISSUERS` (xem mục 3); `VITE_KEYCLOAK_*` ở web; `EXPO_PUBLIC_AUTH_MODE=keycloak` + `EXPO_PUBLIC_KEYCLOAK_*` ở mobile. Cấu hình Keycloak (realm `hfarm`, role `admin`/`staff`/`customer`, client `hfarm-web` và `hfarm-mobile` là public client, Standard flow, Require PKCE S256): README gốc mục "Đăng nhập / Keycloak".
- **Hai tài khoản khác nhau, đừng nhầm** (tên theo chủ dự án; mật khẩu chỉ chủ dự án biết, không ghi vào đâu cả):

  | Tài khoản | Ở đâu | Dùng để |
  |---|---|---|
  | `admin` | realm **master** của Keycloak | Vào trang quản trị Keycloak (http://localhost:8080); là tên + mật khẩu mà `npm run setup:keycloak` hỏi |
  | `admin_hfarm` | realm **hfarm**, role `admin` | Đăng nhập web CMS (http://localhost:5173) |
- Web trên máy dev: nếu `http://127.0.0.1:5173` không mở được hãy dùng `http://localhost:5173` (ghi nhận Vite từng chỉ nghe IPv6 `[::1]`; chưa xác minh lại).

## 2. Keycloak bằng Docker

Container `keycloak-hfarm` (image `quay.io/keycloak/keycloak:26.8.1`, chạy `start-dev`, cổng `8080`). Dữ liệu (realm, client, user) nằm trong **volume `hfarm_keycloak`** gắn vào `/opt/keycloak/data` (đã xác minh bằng `docker inspect`).

> **TUYỆT ĐỐI KHÔNG xóa volume `hfarm_keycloak`**: mất realm `hfarm`, client và toàn bộ tài khoản. Cấm: `docker volume rm hfarm_keycloak`, `docker volume prune`, `docker system prune --volumes`, `docker rm -v keycloak-hfarm`, `docker compose down -v` ở thư mục có Keycloak. Muốn thử nghiệm thì tạo container/volume RIÊNG tên khác, cổng khác.

| Việc | Lệnh |
|---|---|
| Xem trạng thái | `docker ps -a --filter name=keycloak-hfarm` |
| Bật | `docker start keycloak-hfarm` (đợi khoảng 20-30 giây rồi kiểm tra như bước 2 ở mục 1) |
| Tắt | `docker stop keycloak-hfarm` |
| Xem log | `docker logs --tail 50 keycloak-hfarm` (theo dõi liên tục: `docker logs -f keycloak-hfarm`) |
| Mở trang quản trị | http://localhost:8080 (đăng nhập bằng `admin` của realm master; KHÔNG dùng `admin_hfarm`, đó là tài khoản CMS) |
| Tạo lại container, GIỮ dữ liệu (chỉ khi thật sự cần; Chưa xác minh trên máy thật) | `docker stop keycloak-hfarm` rồi `docker rm keycloak-hfarm` (chỉ xóa container, KHÔNG có `-v`) rồi `docker run -d --name keycloak-hfarm -p 8080:8080 -v hfarm_keycloak:/opt/keycloak/data -e KC_BOOTSTRAP_ADMIN_USERNAME=<ADMIN_USER> -e KC_BOOTSTRAP_ADMIN_PASSWORD=<ADMIN_PASSWORD> quay.io/keycloak/keycloak:26.8.1 start-dev`. Hai biến `KC_BOOTSTRAP_ADMIN_*` chỉ có tác dụng khi dữ liệu còn trống |

- Container từng tự thoát (mã 143) giữa phiên làm việc: gặp thì `docker start keycloak-hfarm`.
- Cổng 8080 còn bị container khác của chủ dự án (nginx `web-test`, đang tắt) khai báo; **không bật `web-test` cùng lúc**. Container `knn-local-api` (đang tắt) khai báo cổng 3000, trùng cổng backend.

## 3. Khi đổi mạng (IP máy tính đổi)

Điện thoại không hiểu `localhost`, và Keycloak ghi vào token đúng địa chỉ client đã dùng, nên đổi Wi-Fi/IP phải sửa **4 chỗ**:

1. **`mobile/.env`**: `EXPO_PUBLIC_API_URL=http://<IP_MAY_TINH>:3000/api` và `EXPO_PUBLIC_KEYCLOAK_URL=http://<IP_MAY_TINH>:8080`.
2. **`backend/.env`**: `KEYCLOAK_ISSUERS=http://localhost:8080/realms/hfarm,http://<IP_MAY_TINH>:8080/realms/hfarm` (liệt kê CẢ issuer của web `localhost` lẫn của điện thoại; thay IP cũ bằng IP mới).
3. **Keycloak** (http://localhost:8080 -> realm `hfarm` -> Clients -> `hfarm-mobile` -> Valid redirect URIs): thêm/sửa thành `exp://<IP_MAY_TINH>:8081` và `exp://<IP_MAY_TINH>:8081/*` (giữ `hfarm://*` cho development build). Bản development build không phải sửa vì dùng `hfarm://`.
4. **Chạy lại**: dừng backend (Ctrl+C) rồi `npm run dev`; ở mobile `npx expo start --clear` (biến `EXPO_PUBLIC_*` được nhúng lúc bundle).

Lấy IP: `ipconfig` -> IPv4 của adapter Wi-Fi, hoặc `Get-NetIPAddress -AddressFamily IPv4`. Máy có VPN/adapter ảo (Docker, WSL) thì IP có thể sai: dùng IP trong mã QR/dòng `exp://...` mà Metro in ra. Gợi ý: đặt IP tĩnh hoặc DHCP reservation cho máy.

**Lấy đúng redirect URI** khi Keycloak báo `Invalid parameter: redirect_uri`:
- Cách 1 (chắc nhất): ở Metro tìm dòng `[auth] Redirect URI đang dùng: exp://...` (chỉ có ở bản dev).
- Cách 2: ngay sau khi bấm đăng nhập lỗi, chạy `docker logs --tail 20 keycloak-hfarm`; tìm dòng `WARN [org.keycloak.events] ... type="LOGIN_ERROR" ... clientId="hfarm-mobile" ... error="invalid_redirect_uri", redirect_uri="exp://<IP>:<CONG>/--/login"` (định dạng này đã quan sát được trên Keycloak 26.8.1 của dự án). Đưa phần `exp://<IP>:<CONG>` (và dạng có `/*`) vào Valid redirect URIs.

Docker Compose + điện thoại: đặt `PUBLIC_URL=http://<IP_MAY_TINH>:3100` trong `.env` gốc rồi `docker compose up -d --build`, và `EXPO_PUBLIC_API_URL=http://<IP_MAY_TINH>:3100/api`.

## 4. Tường lửa Windows

Điện thoại phải tới được: backend (3000), Metro/Expo (8081), Keycloak (8080). Mở bằng PowerShell quản trị (lệnh chuẩn của Windows, Chưa xác minh trên máy dự án):

```powershell
netsh advfirewall firewall add rule name="HFarm backend 3000" dir=in action=allow protocol=TCP localport=3000 profile=private
netsh advfirewall firewall add rule name="HFarm Expo 8081"    dir=in action=allow protocol=TCP localport=8081 profile=private
netsh advfirewall firewall add rule name="HFarm Keycloak 8080" dir=in action=allow protocol=TCP localport=8080 profile=private
```
- Cổng 5173 (web CMS) chỉ cần mở khi truy cập CMS từ máy khác. Chạy bằng Docker: thêm 3100 (API) và 8088 (CMS) nếu cần.
- Phải đặt mạng Wi-Fi là **Private**. Gỡ luật: `netsh advfirewall firewall delete rule name="HFarm backend 3000"` (tương tự các luật khác).
- Chỉ mở trong mạng tin cậy; chế độ dev ở backend coi mọi người gọi được là admin.

## 5. Triệu chứng -> nguyên nhân -> cách xử lý

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `node -v` ra v20.x; Expo báo "Node.js is outdated" hoặc lỗi lạ khi `npx expo ...` | PATH mặc định là Node 20.18.0, Expo SDK 58 cần >= 22.13 | `nvm use 24.14.0` (PowerShell quản trị). Nếu không đổi được: `$env:Path = "C:\nvm4w\nodejs;" + $env:Path` (thư mục Node 24 của máy dev) rồi kiểm tra lại `node -v` |
| Trang Keycloak: **`Invalid parameter: redirect_uri`** (đã xác minh) | Redirect URI của app chưa có trong Valid redirect URIs của client; sau khi đổi IP, hoặc Expo đổi cổng (8081 -> 8082) | Lấy URI đúng như mục 3, thêm vào client `hfarm-mobile` (cả dạng không và có `/*`). Web cần `http://localhost:5173/*` trong `hfarm-web` |
| Keycloak báo **`Missing parameter: code_challenge_method`** (đã xác minh trong log) | Client bật **Require PKCE** nhưng yêu cầu đăng nhập không kèm `code_challenge` + `code_challenge_method=S256` (URL tự ghép, công cụ thử API, hoặc code thiếu PKCE) | Dùng đúng luồng của app: web `pkceMethod: 'S256'`, mobile `usePKCE: true`. Không tắt Require PKCE |
| Đăng nhập được nhưng mọi API trả **401** | Issuer trong token không nằm trong `KEYCLOAK_ISSUERS` (hay gặp sau khi đổi IP/dùng `localhost` vs IP khác nhau); hoặc `KEYCLOAK_REALM` sai | Xem log backend: `Token bị từ chối: issuer "..." không có trong danh sách cho phép`; thêm đúng issuer đó vào `KEYCLOAK_ISSUERS`, restart backend |
| API trả **503** `Không kết nối được máy chủ xác thực (Keycloak)` | Backend không tới được `KEYCLOAK_URL` (Keycloak tắt; backend trong Docker mà dùng `localhost`) | Bật Keycloak (mục 2). Backend trong container: `KEYCLOAK_URL=http://host.docker.internal:8080` |
| API trả **403** `Không đủ quyền` | Token đúng nhưng thiếu role `admin`/`staff` (hoặc staff gọi route chỉ admin) | Gán realm role ở Keycloak (Users -> Role mapping), đăng nhập lại để token mới có role |
| API trả **403** `Tài khoản đã bị khóa` | `users.status` không phải `ACTIVE` | Admin mở khóa ở CMS (Khách hàng) hoặc sửa bảng `users` |
| API trả **409** `Email của tài khoản này đã được dùng bởi một tài khoản khác...` | Bảng `users` đã có dòng cùng email với `keycloak_id` khác (ví dụ tạo ở chế độ dev, hoặc tài khoản Keycloak đã xóa rồi đăng ký lại) | Đổi/xóa email dòng cũ trong `users` (cân nhắc kỹ, có thể có đơn hàng gắn vào dòng đó) |
| Lỗi `EADDRINUSE` / "port đã bị dùng" | Cổng 3000/5173/8081/8080 đã có tiến trình khác (container `knn-local-api` dùng 3000, `web-test` dùng 8080, backend/Vite chạy hai lần) | `netstat -ano \| findstr :3000` để lấy PID, `Get-Process -Id <PID>` để biết là gì, tắt đúng tiến trình đó; `docker ps` xem container. Expo tự đề nghị cổng khác (8082...) thì redirect URI đổi theo: phải cập nhật Keycloak |
| Điện thoại: "Không kết nối được máy chủ" | Khác Wi-Fi/cách ly thiết bị; tường lửa; `EXPO_PUBLIC_API_URL` còn IP cũ hoặc quên `--clear`; VPN làm IP sai; backend không chạy | Trên trình duyệt điện thoại mở `http://<IP_MAY_TINH>:3000/api/products?limit=1`. Sửa theo mục 3 và 4 |
| Điện thoại: "Không kết nối được máy chủ đăng nhập" | Điện thoại không tới được Keycloak (`EXPO_PUBLIC_KEYCLOAK_URL` sai, cổng 8080 bị chặn, Keycloak tắt) | Mở `http://<IP_MAY_TINH>:8080` trên điện thoại; mục 2 và 4 |
| App báo "Cấu hình đăng nhập chưa đúng" + nút "Đăng nhập bằng trình duyệt" | Client `hfarm-mobile` chưa bật Direct access grants (lỗi `unauthorized_client`/`invalid_client`) | Chỉ khi chủ dự án chấp nhận rủi ro (xem [ARCHITECTURE.md](ARCHITECTURE.md) mục 7): `cd backend` rồi `npm run setup:keycloak -- --write-env` (hỏi tên + mật khẩu quản trị Keycloak: nhập tài khoản `admin` của realm master, không phải `admin_hfarm`). Nếu không, dùng luồng trình duyệt dự phòng |
| App hiện form Đăng ký bằng trình duyệt thay vì form trong app | `GET /api/auth/config` trả `registration: false` (backend thiếu `KEYCLOAK_ADMIN_CLIENT_ID/SECRET` hoặc `AUTH_ENABLED` khác `true`) | Chạy `npm run setup:keycloak -- --write-env`, restart backend |
| Backend trả 500 `Lỗi server` ở mọi API; console có lỗi `ECONNREFUSED` hoặc `Access denied` | MySQL chưa chạy / sai `DB_HOST`, `DB_PORT` / sai `DB_PASSWORD` | Bật MySQL (mục 1 bước 3), kiểm tra `backend/.env` rồi restart backend |
| Web: màn "Không kết nối được máy chủ đăng nhập (Keycloak)" | Keycloak tắt hoặc `VITE_KEYCLOAK_URL` sai | Bật Keycloak, kiểm tra `web/.env`, restart `npm run dev` |
| Web: "Thiếu cấu hình Keycloak trong web/.env: ..." | Thiếu biến `VITE_KEYCLOAK_*` và không bật `VITE_AUTH_DISABLED` | Bổ sung `web/.env`, restart `npm run dev` |
| Web: màn "Bạn không có quyền truy cập" | Tài khoản không có role `admin`/`staff` | Gán role ở Keycloak rồi đăng nhập lại |
| Ảnh sản phẩm không hiện trên điện thoại | URL ảnh lưu theo `PUBLIC_URL`; app chỉ đổi `localhost`/`127.0.0.1` sang host API (suy ra từ `resolveImageUrl`), URL mang IP cũ thì giữ nguyên | Kiểm tra mở được `http://<IP_MAY_TINH>:3000/uploads/<tên-ảnh>`; đặt `PUBLIC_URL` đúng rồi tải lại ảnh |
| Docker: đổi `DB_PASSWORD` mà MySQL vẫn báo sai | Mật khẩu chỉ áp dụng lúc tạo volume `hfarm-db` lần đầu | `docker compose down -v` (XÓA dữ liệu Docker, không đụng MySQL trên máy) rồi `up` lại |
| Docker: đổi `PUBLIC_URL`/`VITE_*` mà CMS vẫn gọi địa chỉ cũ | Biến `VITE_*` được nhúng lúc build | `docker compose up -d --build` |
| `npx expo lint` làm đổi `mobile/package.json` | Lệnh này tự cài eslint và thêm script `lint` | Đừng chạy, hoặc hoàn tác ngay (`npm uninstall` gói vừa cài, xóa `eslint.config.js`) |

## 6. Câu SQL kiểm tra (chỉ SELECT)

Chạy bằng MySQL Workbench hoặc `mysql -u <DB_USER> -p clothing_store -e "<câu lệnh>"`. **Chỉ SELECT.** Đừng chạy `database/schema.sql` trên database có dữ liệu (nó `DROP` mọi bảng).

```sql
-- Người dùng đã đồng bộ từ Keycloak (keycloak_id = sub của token)
SELECT id, keycloak_id, email, user_type, status, created_at FROM users ORDER BY id DESC LIMIT 20;
SELECT user_type, status, COUNT(*) AS n FROM users GROUP BY user_type, status;

-- Đơn hàng gần đây và thống kê theo trạng thái
SELECT id, order_code, user_id, status, payment_status, total_amount, created_at FROM orders ORDER BY id DESC LIMIT 20;
SELECT status, COUNT(*) AS n FROM orders GROUP BY status;

-- Tồn kho thấp nhất theo biến thể
SELECT p.name, v.sku, s.name AS size_name, c.name AS color_name, COALESCE(i.quantity, 0) AS stock
FROM product_variants v
JOIN products p ON p.id = v.product_id
JOIN sizes s ON s.id = v.size_id
JOIN colors c ON c.id = v.color_id
LEFT JOIN inventories i ON i.variant_id = v.id
ORDER BY stock ASC, p.name LIMIT 20;

-- Lịch sử kho gần đây (ORDER_DEDUCT = trừ do đặt hàng, ORDER_RESTOCK = hoàn do hủy/trả)
SELECT m.id, v.sku, m.movement_type, m.quantity_change, m.quantity_before, m.quantity_after,
       m.reference_type, m.reference_id, m.created_at
FROM inventory_movements m JOIN product_variants v ON v.id = m.variant_id
ORDER BY m.id DESC LIMIT 30;

-- Đối soát: tồn hiện tại khác số "sau" của dòng lịch sử cuối cùng (kỳ vọng: không có dòng nào)
SELECT v.sku, i.quantity AS stock_now,
       (SELECT m.quantity_after FROM inventory_movements m WHERE m.variant_id = v.id ORDER BY m.id DESC LIMIT 1) AS last_after
FROM product_variants v JOIN inventories i ON i.variant_id = v.id
HAVING last_after IS NOT NULL AND stock_now <> last_after;

-- Một đơn: dòng hàng, lịch sử trạng thái, thanh toán, vận chuyển (thay <ID_DON>)
SELECT * FROM order_items WHERE order_id = <ID_DON>;
SELECT * FROM order_status_history WHERE order_id = <ID_DON> ORDER BY id;
SELECT * FROM payments WHERE order_id = <ID_DON>;
SELECT * FROM shipments WHERE order_id = <ID_DON>;
```

## 7. Docker Compose của dự án (`docker-compose.yml`, project `hfarm`)

Chạy MySQL + backend + web CMS (nginx) mà không cần cài gì khác ngoài Docker. Cổng mặc định chọn để không đụng bản dev:

| Dịch vụ | Cổng máy | Ghi chú |
|---|---|---|
| CMS (nginx) | `8088` (`WEB_PORT`) | http://localhost:8088 |
| API | `3100` (`API_PORT`) | http://localhost:3100/api/products |
| MySQL trong Docker | `3307` (`DB_HOST_PORT`) | khác 3306 của MySQL cài trên máy |

```powershell
cd "<THU_MUC_DU_AN>"
Copy-Item .env.example .env     # tùy chọn: đổi cổng, mật khẩu, PUBLIC_URL
docker compose up -d --build    # lần đầu / sau khi sửa mã nguồn hoặc biến VITE_*, PUBLIC_URL
docker compose ps
docker compose logs -f backend
docker compose down             # dừng, GIỮ dữ liệu (volume hfarm-db, hfarm-uploads)
```
- MySQL của Compose là **riêng** (volume `hfarm-db`), không dùng `clothing_store` trên máy. Lần đầu database trống được nạp từ `database/schema.sql` (dữ liệu mẫu: size, màu, 4 danh mục; **chưa có sản phẩm**: nhập qua CMS). Ảnh tải lên nằm trong volume `hfarm-uploads`.
- `docker compose down -v` XÓA dữ liệu của project này (không ảnh hưởng MySQL trên máy và không ảnh hưởng volume `hfarm_keycloak`; vẫn chỉ chạy khi chắc chắn).
- **Mặc định là chế độ dev** (`AUTH_ENABLED=false`, CMS `VITE_AUTH_DISABLED=true`): **ai gọi được API đều là admin** và CORS mở cho mọi origin. Cổng `3100`, `3307`, `8088` được publish trên mọi giao diện mạng của máy. **Chỉ chạy thử trên máy mình, không mở ra Internet/mạng không tin cậy.** Mật khẩu root MySQL có giá trị mặc định ngay trong `docker-compose.yml`: đổi qua `DB_PASSWORD` trước khi dùng thật.
- Dùng Keycloak với Compose (chưa thử, theo README): trong `.env` gốc đặt `AUTH_ENABLED=true`, `VITE_AUTH_DISABLED=false`, `KEYCLOAK_URL=http://host.docker.internal:8080` (địa chỉ container với tới được), `KEYCLOAK_REALM=hfarm`, `VITE_KEYCLOAK_URL=http://localhost:8080`, `VITE_KEYCLOAK_REALM=hfarm`, `VITE_KEYCLOAK_CLIENT_ID=hfarm-web`. Suy ra từ code (Chưa xác minh): cần thêm `KEYCLOAK_ISSUERS=http://localhost:8080/realms/hfarm` (token do trình duyệt lấy mang issuer `localhost`) và `CORS_ORIGIN=http://localhost:8088` (mặc định khi bật xác thực chỉ cho `http://localhost:5173`), và client `hfarm-web` phải có redirect URI/web origin `http://localhost:8088`.
- Mang dữ liệu từ MySQL máy sang Docker bằng `mysqldump` (README): lệnh thông dụng, **chưa thử** trên dữ liệu thật.
