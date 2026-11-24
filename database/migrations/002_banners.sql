-- Migration 002: banner trang chủ app mobile (quản lý trong CMS)
--
-- CHỈ THÊM. Chạy đúng một lần: mysql -u <user> -p clothing_store < database/migrations/002_banners.sql
-- Không có banner nào đang bật thì app hiện banner mặc định của cửa hàng.

SET NAMES utf8mb4;

CREATE TABLE banners (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  subtitle VARCHAR(250) NULL,
  image_url VARCHAR(500) NOT NULL,
  -- NONE: không bấm được | CATEGORY: link_value = id danh mục | PRODUCT: link_value = id sản phẩm
  -- COLLECTION: link_value = new | bestseller | sale
  link_type ENUM('NONE','CATEGORY','PRODUCT','COLLECTION') NOT NULL DEFAULT 'NONE',
  link_value VARCHAR(100) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_banners_active (is_active, sort_order)
) ENGINE=InnoDB;
