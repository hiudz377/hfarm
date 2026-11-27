-- Migration 004: Mua nhóm (group buy): giá giảm theo số người trong nhóm, mời bạn bè bằng mã / link
--
-- CHỈ THÊM, không xóa/ghi đè dữ liệu cũ. CHẠY ĐÚNG MỘT LẦN trên database đã dựng từ schema.sql + migration 001-003
-- (chạy lần hai sẽ báo "Duplicate column"/"already exists": vô hại nhưng lệnh sau lỗi đó không chạy tiếp).
-- Cách chạy (đổi tên database nếu cần): mysql -u <user> -p clothing_store < database/migrations/004_group_buy.sql
-- Backend kiểm tra các bảng/cột này khi khởi động và báo rõ nếu chưa chạy.
--
-- Mọi sản phẩm hiện có giữ nguyên: group_buy_enabled = 0 (chưa mở mua nhóm) cho tới khi nhân viên bật ở CMS.
-- Không ảnh hưởng giỏ hàng, đơn hàng, kho.

SET NAMES utf8mb4;

-- 1. Bật / tắt mua nhóm theo sản phẩm + thời gian rủ bạn (giờ) kể từ lúc tạo nhóm
ALTER TABLE products
  ADD COLUMN group_buy_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN group_buy_hours SMALLINT UNSIGNED NOT NULL DEFAULT 48;

-- 2. Các bậc giá của sản phẩm: đủ min_members người thì mỗi người được giảm discount_percent %
--    (ví dụ 3 người giảm 10%, 5 người giảm 20%). Bậc nhiều người hơn phải giảm nhiều hơn (backend kiểm tra).
CREATE TABLE product_group_tiers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  min_members SMALLINT UNSIGNED NOT NULL,
  discount_percent DECIMAL(5,2) NOT NULL,
  UNIQUE KEY uq_group_tier (product_id, min_members),
  CONSTRAINT chk_group_tier_members CHECK (min_members >= 2),
  CONSTRAINT chk_group_tier_percent CHECK (discount_percent > 0 AND discount_percent <= 80),
  CONSTRAINT fk_group_tier_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. Nhóm mua. code: mã mời 8 ký tự (bỏ I, O, 0, 1 cho dễ đọc). tiers: CHỤP bậc giá lúc tạo nhóm (đổi cấu hình
--    sản phẩm sau đó không làm đổi nhóm đang chạy). OPEN còn rủ thêm người tới expires_at; hết hạn hoặc đủ người
--    thì chốt: SUCCESS (đạt ít nhất bậc đầu, final_percent = mức giảm chốt, thành viên có tới claim_until để mua)
--    hoặc FAILED (không đạt bậc nào). CANCELLED: chủ nhóm / nhân viên hủy khi còn OPEN.
CREATE TABLE buy_groups (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code CHAR(8) NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  leader_id BIGINT UNSIGNED NOT NULL,
  status ENUM('OPEN','SUCCESS','FAILED','CANCELLED') NOT NULL DEFAULT 'OPEN',
  tiers JSON NOT NULL,
  expires_at DATETIME NOT NULL,
  closed_at DATETIME NULL,
  final_members SMALLINT UNSIGNED NULL,
  final_percent DECIMAL(5,2) NULL,
  claim_until DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_buy_groups_code (code),
  KEY idx_buy_groups_status_expiry (status, expires_at),
  KEY idx_buy_groups_leader (leader_id, status),
  KEY idx_buy_groups_product (product_id),
  CONSTRAINT fk_buy_groups_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_buy_groups_leader FOREIGN KEY (leader_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- 4. Thành viên nhóm (kể cả chủ nhóm). variant_id: mẫu mã (size x màu) đã chọn, chỉ ĐÚNG mẫu mã này được giảm giá nhóm.
--    order_id / discount_amount: được điền khi thành viên mua theo giá nhóm (đơn bị hủy thì được mua lại trong hạn).
--    Chưa trả tiền lúc tham gia: chỉ trả khi mua (dự án chưa có hoàn tiền tự động).
CREATE TABLE buy_group_members (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  variant_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  discount_amount DECIMAL(12,2) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_group_member (group_id, user_id),
  KEY idx_group_member_user (user_id),
  KEY idx_group_member_order (order_id),
  CONSTRAINT fk_group_member_group FOREIGN KEY (group_id) REFERENCES buy_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_group_member_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_group_member_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id),
  CONSTRAINT fk_group_member_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB;
