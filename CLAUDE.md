# HFarm

Hệ thống quản lý + bán quần áo: **backend** Node/Express + MySQL, **web CMS** (React + Ant Design) cho admin/staff, **app mobile** (Expo) cho khách hàng.
Đăng nhập bằng Keycloak (realm `hfarm`); có chế độ dev không cần Keycloak. Giao diện và thông báo lỗi bằng tiếng Việt có dấu.
Đường dẫn dự án có dấu cách (`...\HTBanQA (1)\HTBanQA`): luôn bọc `"..."` khi `cd`. Máy dùng Windows + PowerShell.

## Công nghệ và cổng
| Phần | Công nghệ | Cổng (dev) | Cổng Docker Compose |
|---|---|---|---|
| `backend/` | Node (Express 4, mysql2, jose, multer) | 3000 | 3100 |
| `web/` | React 18, Vite 5, Ant Design 5, keycloak-js | 5173 | 8088 (nginx) |
| `mobile/` | Expo SDK 58, React Native 0.88, Expo Router, React Query (JavaScript) | Metro 8081 | - |
| MySQL 8, database `clothing_store` | `database/schema.sql` (22 bảng) | 3306 | 3307 |
| Keycloak 26.8.1 (Docker `keycloak-hfarm`, volume `hfarm_keycloak`) | realm `hfarm` | 8080 | - |

## Chạy tóm tắt (chi tiết: `docs/RUNBOOK.md`)
- Mở PowerShell **bằng quyền Administrator**; mỗi cửa sổ: `cd "<THU_MUC_DU_AN>\<thư mục>"` rồi `nvm use 24.14.0` (Expo cần Node >= 22.13; PATH mặc định là v20).
- Thứ tự bật: **Docker Desktop -> Keycloak (`docker start keycloak-hfarm`) -> MySQL -> backend (`npm run dev`) -> web (`npm run dev`) -> mobile (`npx expo start`, thêm `--clear` sau khi sửa `.env`)**.
- Mobile trên điện thoại: `.env` dùng IP LAN `<IP_MAY_TINH>`, không dùng `localhost`. Đổi mạng phải sửa 4 chỗ (RUNBOOK mục 3).
- Cấm: xóa volume `hfarm_keycloak`; chạy `database/schema.sql` trên DB có dữ liệu (nó `DROP` mọi bảng).

## Xác thực (chi tiết: `docs/ARCHITECTURE.md` mục 3)
- **Hai tài khoản, đừng nhầm**: `admin` (realm **master**) = vào trang quản trị Keycloak và là tài khoản `npm run setup:keycloak` hỏi; `admin_hfarm` (realm **hfarm**, role `admin`) = đăng nhập web CMS. Mật khẩu chỉ chủ dự án biết.
- Realm `hfarm`, role: `admin`, `staff`, `customer`. CMS chỉ cho `admin`/`staff`; `staff` không dùng được Khách hàng, Mã giảm giá và thao tác ghi Danh mục/Thương hiệu/Size/Màu.
- Client `hfarm-web` và `hfarm-mobile` là **public client**, Standard flow, **Require PKCE (S256)**. Backend không giữ secret của chúng.
- Backend: `AUTH_ENABLED` (true = bắt token), `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_ISSUERS` (nhiều issuer: web `localhost` + điện thoại IP LAN). `middleware/auth.js`: JWKS -> issuer -> hạn -> đồng bộ `users` theo `sub`; 401 = token sai/thiếu, 403 = thiếu quyền/bị khóa, 503 = Keycloak không tới được.
- Chế độ dev (`AUTH_ENABLED` khác `true`): header `X-Dev-Role: admin|staff|customer` (mặc định `DEV_ROLE`). **Ai gọi API cũng là admin: không mở ra ngoài.**
- Đăng ký/đăng nhập ngay trong app: `POST /api/auth/register` (backend dùng client `hfarm-backend` gọi Keycloak Admin API) + password grant (cần Direct access grants cho `hfarm-mobile`, bật bằng `npm run setup:keycloak`). Rủi ro: ARCHITECTURE mục 7.

## Quy tắc khi sửa code
1. **Không sửa `database/schema.sql`.** Cần đổi cấu trúc thì tạo file trong `database/migrations/` (thư mục chưa có, hãy tạo) và nói rõ cách áp dụng.
2. **Không đổi logic đặt hàng / trừ kho / hoàn kho** ở `backend/src/services/orders.js` và `backend/src/services/stock.js` trừ khi có lỗi thật; khi đó phải nói rõ sửa gì và vì sao.
3. **Mọi route admin phải đi qua middleware role ở backend** (`requireRole`), không chỉ ẩn ở giao diện. Route mới -> cập nhật bảng phân quyền trong `docs/ARCHITECTURE.md` và `docs/API.md`.
4. **SQL luôn dùng tham số `?`**; không ghép chuỗi người dùng vào SQL (cột sắp xếp chỉ lấy từ danh sách cố định như `SORTS`).
5. Giao diện tiếng Việt **có dấu**; tiền dạng `1.250.000 ₫` (web: `money()` trong `web/src/utils.js`; mobile: `money()` trong `mobile/src/utils/format.js`).
6. **Không ghi secret** (mật khẩu, token, client secret, nội dung `.env`, email/IP thật) vào code, README hay docs. Kho GitHub là PUBLIC. Chỉ ghi TÊN biến + giá trị mẫu giả.
7. **Không chạy lệnh phá hủy khi chưa hỏi**: `docker rm`/`volume rm`, `DROP`, chạy lại `schema.sql`, `npm run setup:keycloak`, `docker compose down -v`, `git reset --hard`...
8. Báo cáo cuối **tối đa 15 dòng**, nói thẳng phần nào **đã kiểm tra thật** (chạy gì, trên đâu) và phần nào **chưa** (điện thoại thật, Keycloak thật...).
9. Thử ghi dữ liệu (giỏ, đơn, kho) phải trên database tạm (dựng từ `schema.sql` đã đổi tên DB, xong thì `DROP` đúng DB tạm), không bao giờ trên `clothing_store`.

Mobile (Expo; bản đầy đủ `mobile/AGENTS.md`): Expo đổi API mỗi SDK, đọc `https://docs.expo.dev/versions/v58.0.0/` trước khi dùng API Expo/RN; thêm gói bằng `npx expo install`; màn hình ở `mobile/src/app/` (file `.js`, dự án KHÔNG dùng TypeScript, chưa có lint/tsc); không sửa tay `ios/` `android/`. **Đừng chạy `npx expo lint`**: nó tự cài eslint và sửa `package.json`.
Mọi `EXPO_PUBLIC_*`, `VITE_*` đều nhúng vào bản build nên không đặt bí mật; đổi xong phải restart/`--clear`/build lại.

## Tình trạng (chi tiết: `docs/STATUS.md`)
- Xong: backend đầy đủ (catalog, giỏ, đặt hàng an toàn đồng thời, đơn hàng + hoàn kho, đánh giá, yêu thích, CMS), web CMS 9 trang, app mobile đủ luồng mua hàng, đăng nhập/đăng ký trong app, Docker Compose.
- Đã test trên DB tạm + Keycloak thử nghiệm + bản web của app trên Edge; **chưa thử điện thoại thật/Expo Go**, chưa chạy `setup:keycloak` trên Keycloak thật.
- Chưa có: test trong repo, thanh toán online, thông tin chuyển khoản thật (`mobile/src/utils/bankConfig.js` là giả), theme đăng nhập Keycloak, quên mật khẩu/xác minh email (cần SMTP), thông báo đẩy.
- Mặc định Docker/dev là chế độ không xác thực: chỉ chạy trên máy mình.
- Việc tiếp theo gợi ý: thử điện thoại thật, đưa test vào repo, chốt chiến lược đăng nhập app (Direct access grants), thanh toán thật.

## Đọc file nào khi nào
| Cần làm gì | Đọc |
|---|---|
| Hiểu tổng thể, luồng đăng nhập, luồng đặt hàng, bảng trạng thái đơn, phân quyền, mô hình dữ liệu, biến môi trường, lưu ý bảo mật | `docs/ARCHITECTURE.md` |
| Thêm/sửa/gọi endpoint, mã lỗi tiếng Việt | `docs/API.md` |
| Chạy máy, đổi mạng/IP, Docker/Keycloak, tường lửa, xử lý lỗi hay gặp, câu SQL kiểm tra | `docs/RUNBOOK.md` |
| Biết đã làm/chưa làm gì, đã kiểm tra thế nào, nợ kỹ thuật, nên làm gì tiếp | `docs/STATUS.md` |
| Cài đặt + cấu hình Keycloak từng bước (bản gốc) | `README.md` (mục Đăng nhập / Keycloak) |
| Chi tiết app mobile, nhật ký kiểm tra từng giai đoạn (mô tả từng giai đoạn là lịch sử lúc đó) | `mobile/README.md`, `mobile/PLAN.md` |
| Quy tắc Expo + ghi chú dự án mobile | `mobile/AGENTS.md` |
| Cấu trúc bảng | `database/schema.sql` (chỉ đọc) |

Khi docs và code mâu thuẫn thì **theo code**, rồi sửa docs.

## Giữ tài liệu cập nhật
Khi xong một tính năng (hoặc kiểm tra thêm điều gì): cập nhật `docs/STATUS.md` (Đã làm / Đã-chưa kiểm tra / Hạn chế / Ý tưởng) **và** các file docs liên quan: endpoint mới -> `docs/API.md`; luồng, phân quyền, bảng, biến môi trường mới -> `docs/ARCHITECTURE.md`; lệnh chạy/lỗi mới -> `docs/RUNBOOK.md`. Đổi API công khai thì cập nhật cả `README.md`. Sửa `CLAUDE.md` chỉ khi quy tắc hoặc bản đồ file đổi (giữ dưới ~150 dòng).
