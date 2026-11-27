-- Migration 005: Đơn quà tặng (thiệp + tùy chọn ẩn giá / gói quà gắn với một đơn hàng)
--
-- CHỈ THÊM một bảng mới, không đụng dữ liệu cũ, không đổi bảng orders / order_items / kho.
-- CHẠY ĐÚNG MỘT LẦN trên database đã dựng từ schema.sql + migration 001-004
-- (chạy lần hai sẽ báo "already exists": vô hại).
-- Cách chạy (đổi tên database nếu cần): mysql -u <user> -p clothing_store < database/migrations/005_gift_orders.sql
-- Backend kiểm tra bảng này khi khởi động và báo rõ nếu chưa chạy.
--
-- Mỗi đơn quà có đúng một dòng. Đơn thường không có dòng nào. Xóa đơn thì dòng này tự xóa theo.

SET NAMES utf8mb4;

CREATE TABLE order_gifts (
  order_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  -- mã dịp (BIRTHDAY, VALENTINE...): danh sách mã nằm ở backend/src/services/gifts.js, không khóa bằng ENUM
  occasion VARCHAR(20) NOT NULL,
  -- mã mẫu thiệp (cũng nằm ở services/gifts.js); NULL = không kèm thiệp
  card_template VARCHAR(40) NULL,
  card_message VARCHAR(500) NULL,
  sender_name VARCHAR(60) NULL,
  -- 1 = phiếu giao hàng in từ CMS không có giá
  hide_prices BOOLEAN NOT NULL DEFAULT TRUE,
  -- 1 = khách mua kèm sản phẩm "gói quà" (nhân viên cần gói hộp)
  wrap BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_order_gifts_created (created_at),
  CONSTRAINT fk_order_gifts_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;
