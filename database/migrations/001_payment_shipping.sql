-- Migration 001: thanh toán chuyển khoản (VietQR) + giao hàng tự quản
--
-- CHỈ THÊM, không xóa/ghi đè dữ liệu cũ. CHẠY ĐÚNG MỘT LẦN trên database đã dựng từ schema.sql
-- (chạy lần hai sẽ báo "Duplicate column"/"already exists": vô hại nhưng lệnh sau lỗi đó không chạy tiếp).
-- Cách chạy (đổi tên database nếu cần): mysql -u <user> -p clothing_store < database/migrations/001_payment_shipping.sql
-- Backend kiểm tra các bảng/cột này khi khởi động và báo rõ nếu chưa chạy.

SET NAMES utf8mb4;

-- 1. Hạn thanh toán của đơn chuyển khoản: quá hạn mà chưa trả thì backend tự hủy đơn và hoàn kho
ALTER TABLE orders
  ADD COLUMN payment_expires_at DATETIME NULL AFTER payment_status,
  ADD KEY idx_orders_payment_expiry (payment_status, payment_expires_at);

-- 2. Giao dịch ngân hàng nhận được qua webhook (SePay/Casso...): chống xử lý trùng + tra cứu giao dịch không khớp đơn nào
CREATE TABLE bank_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(40) NOT NULL,
  provider_tx_id VARCHAR(100) NOT NULL,
  account_number VARCHAR(40) NULL,
  amount DECIMAL(14,2) NOT NULL,
  content VARCHAR(500) NULL,
  transaction_time DATETIME NULL,
  order_id BIGINT UNSIGNED NULL,
  match_status ENUM('MATCHED','UNMATCHED','AMOUNT_MISMATCH','ORDER_CLOSED','ALREADY_PAID') NOT NULL,
  note VARCHAR(500) NULL,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  raw JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_bank_tx (provider, provider_tx_id),
  KEY idx_bank_tx_status (match_status, resolved),
  CONSTRAINT fk_bank_tx_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 3. Phí vận chuyển theo vùng. provinces = mảng tên tỉnh/thành (so khớp không phân biệt hoa thường, dấu, "Tỉnh"/"TP.").
--    Vùng mặc định (is_default = 1, provinces = NULL) áp dụng cho mọi nơi không thuộc vùng nào khác.
CREATE TABLE shipping_zones (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  provinces JSON NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  fee DECIMAL(12,2) NOT NULL,
  free_over DECIMAL(12,2) NULL,
  eta_min_days TINYINT UNSIGNED NOT NULL DEFAULT 2,
  eta_max_days TINYINT UNSIGNED NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_zone_fee CHECK (fee >= 0 AND (free_over IS NULL OR free_over >= 0)),
  CONSTRAINT chk_zone_eta CHECK (eta_min_days <= eta_max_days)
) ENGINE=InnoDB;

-- Giữ đúng hành vi cũ (phí 30.000 ₫, miễn phí từ 500.000 ₫); chỉnh/thêm vùng trong CMS
INSERT INTO shipping_zones (name, provinces, is_default, fee, free_over, eta_min_days, eta_max_days)
VALUES ('Toàn quốc', NULL, TRUE, 30000, 500000, 2, 5);

-- 4. Sự kiện hành trình do nhân viên ghi (đã đến kho, giao thất bại lần 1...). Các mốc đổi trạng thái đơn lấy từ order_status_history.
CREATE TABLE shipment_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  location VARCHAR(150) NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_shipment_events_order (order_id, created_at),
  CONSTRAINT fk_shipment_events_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_shipment_events_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
