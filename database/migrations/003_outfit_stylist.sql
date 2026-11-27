-- Migration 003: Stylist (gợi ý bộ đồ) - thẻ phối đồ cho sản phẩm
--
-- CHỈ THÊM cột, không xóa/ghi đè dữ liệu cũ. CHẠY ĐÚNG MỘT LẦN trên database đã dựng từ schema.sql
-- (chạy lần hai sẽ báo "Duplicate column": vô hại nhưng lệnh sau lỗi đó không chạy tiếp).
-- Cách chạy (đổi tên database nếu cần): mysql -u <user> -p clothing_store < database/migrations/003_outfit_stylist.sql
-- Backend kiểm tra các cột này khi khởi động và báo rõ nếu chưa chạy.
--
-- Sản phẩm hiện có giữ nguyên: gender = UNISEX, outfit_role = NULL (chưa gắn thẻ) nên CHƯA xuất hiện trong gợi ý bộ đồ
-- cho tới khi nhân viên gắn thẻ trong CMS (ngăn sản phẩm, mục "Gợi ý bộ đồ"). Không ảnh hưởng gì tới cửa hàng, giỏ, đơn hàng.

SET NAMES utf8mb4;

ALTER TABLE products
  -- Dành cho ai: khách chọn Nam thì chỉ thấy MALE + UNISEX, chọn Nữ thì FEMALE + UNISEX, chọn Khác thì thấy tất cả
  ADD COLUMN gender ENUM('MALE','FEMALE','UNISEX') NOT NULL DEFAULT 'UNISEX' AFTER brand_id,
  -- Vai trò trong một bộ đồ: TOP áo | BOTTOM quần/chân váy | OUTERWEAR áo khoác | DRESS váy/đầm liền | SHOES giày | ACCESSORY phụ kiện.
  -- NULL = chưa gắn thẻ, không dùng để phối
  ADD COLUMN outfit_role ENUM('TOP','BOTTOM','OUTERWEAR','DRESS','SHOES','ACCESSORY') NULL AFTER gender,
  -- Phong cách / hoàn cảnh: danh sách mã cách nhau dấu phẩy (ví dụ 'MINIMALIST,CASUAL'). Rỗng = hợp mọi phong cách / hoàn cảnh.
  -- Danh sách mã hợp lệ nằm trong backend/src/services/stylist.js (không khóa bằng ENUM để thêm mã mới không cần migration)
  ADD COLUMN styles VARCHAR(150) NOT NULL DEFAULT '' AFTER outfit_role,
  ADD COLUMN occasions VARCHAR(150) NOT NULL DEFAULT '' AFTER styles,
  ADD KEY idx_products_outfit (status, outfit_role);
