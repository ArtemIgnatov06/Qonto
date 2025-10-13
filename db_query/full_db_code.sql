-- =========================
-- БАЗА И НАСТРОЙКИ
-- =========================
CREATE DATABASE IF NOT EXISTS qonto
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
USE qonto;

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- =========================
-- USERS
-- =========================
CREATE TABLE users (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email             VARCHAR(150) NOT NULL,
  phone             VARCHAR(50)  DEFAULT NULL,
  username          VARCHAR(100) DEFAULT NULL,
  password_hash     VARCHAR(255) DEFAULT NULL,
  first_name        VARCHAR(100) DEFAULT NULL,
  last_name         VARCHAR(100) DEFAULT NULL,
  contact_email     VARCHAR(255) DEFAULT NULL,
  google_id         VARCHAR(64)  DEFAULT NULL,
  role              ENUM('user','admin') NOT NULL DEFAULT 'user',
  seller_status     ENUM('none','pending','approved') NOT NULL DEFAULT 'none', -- по скрину: 'none','pend...' -> дополнил 'approved'
  seller_rejection_reason VARCHAR(500) DEFAULT NULL,

  email_verified    TINYINT(1) NOT NULL DEFAULT 0,
  email_verification_code    VARCHAR(16)  DEFAULT NULL,
  email_verification_expires DATETIME     DEFAULT NULL,

  login_otp_code    VARCHAR(16)  DEFAULT NULL,
  login_otp_expires DATETIME     DEFAULT NULL,

  last_seen_at      DATETIME     DEFAULT NULL,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NULL     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uniq_users_email    (email),
  UNIQUE KEY uniq_users_phone    (phone),
  UNIQUE KEY uniq_users_username (username),
  KEY idx_users_last_seen_at (last_seen_at),
  KEY idx_users_role (role),
  KEY idx_users_seller_status (seller_status),
  KEY idx_users_google_id (google_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Резервная таблица (из скрина users_backup)
CREATE TABLE users_backup (
  id                BIGINT UNSIGNED NOT NULL,
  email             VARCHAR(150) NOT NULL,
  phone             VARCHAR(50)  DEFAULT NULL,
  username          VARCHAR(100) DEFAULT NULL,
  password_hash     VARCHAR(255) DEFAULT NULL,
  first_name        VARCHAR(100) DEFAULT NULL,
  last_name         VARCHAR(100) DEFAULT NULL,
  contact_email     VARCHAR(255) DEFAULT NULL,
  google_id         VARCHAR(64)  DEFAULT NULL,
  role              ENUM('user','admin') NOT NULL DEFAULT 'user',
  seller_status     ENUM('none','pending','approved') NOT NULL DEFAULT 'none',
  seller_rejection_reason VARCHAR(500) DEFAULT NULL,
  email_verified    TINYINT(1) NOT NULL DEFAULT 0,
  email_verification_code    VARCHAR(16)  DEFAULT NULL,
  email_verification_expires DATETIME     DEFAULT NULL,
  login_otp_code    VARCHAR(16)  DEFAULT NULL,
  login_otp_expires DATETIME     DEFAULT NULL,
  last_seen_at      DATETIME     DEFAULT NULL,
  created_at        TIMESTAMP    NULL DEFAULT NULL,
  updated_at        TIMESTAMP    NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_users_backup_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- OTP (email / phone)
-- =========================
CREATE TABLE email_otps (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email       VARCHAR(255) NOT NULL,
  code_hash   VARCHAR(255) NOT NULL,
  expires_at  DATETIME NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_email (email),
  KEY idx_email_otps_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE phone_otps (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  phone       VARCHAR(50) NOT NULL,
  code_hash   VARCHAR(255) NOT NULL,
  expires_at  DATETIME NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_phone (phone),
  KEY idx_phone_otps_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- КАТЕГОРИИ
-- =========================
CREATE TABLE categories (
  id     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name   VARCHAR(255) NOT NULL,
  slug   VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_categories_name (name),
  UNIQUE KEY uniq_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- ТОВАРЫ
-- =========================
CREATE TABLE products (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  seller_id     BIGINT UNSIGNED NOT NULL,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  price         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  category      VARCHAR(100) DEFAULT NULL,  -- на скрине категория строкой
  status        ENUM('draft','active','archived') NOT NULL DEFAULT 'active', -- 'enum('draft','active', ...)' -> дополнил 'archived'
  stock_qty     INT UNSIGNED NOT NULL DEFAULT 0,
  main_image    VARCHAR(512) DEFAULT NULL,
  images_json   JSON DEFAULT NULL,          -- под «несколько фото»
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME DEFAULT NULL,

  PRIMARY KEY (id),
  KEY idx_products_seller_id (seller_id),
  KEY idx_products_category (category),
  KEY idx_products_status (status),
  KEY idx_products_price (price),
  KEY idx_products_created_at (created_at),
  KEY idx_products_updated_at (updated_at),
  FULLTEXT KEY ftx_products_text (title, description),

  CONSTRAINT fk_products_seller
    FOREIGN KEY (seller_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- История удалений (product_deletions)
CREATE TABLE product_deletions (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id  BIGINT UNSIGNED NOT NULL,
  seller_id   BIGINT UNSIGNED NOT NULL,
  admin_id    BIGINT UNSIGNED DEFAULT NULL,
  title       VARCHAR(255) NOT NULL,
  category    VARCHAR(100) DEFAULT NULL,
  price       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  reason      TEXT DEFAULT NULL,
  comment     TEXT DEFAULT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pd_product_id (product_id),
  KEY idx_pd_seller_id (seller_id),
  KEY idx_pd_admin_id (admin_id),
  KEY idx_pd_created_at (created_at),
  CONSTRAINT fk_pd_product  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_pd_seller   FOREIGN KEY (seller_id)  REFERENCES users(id)    ON DELETE SET NULL,
  CONSTRAINT fk_pd_admin    FOREIGN KEY (admin_id)   REFERENCES users(id)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Оценки/отзывы
CREATE TABLE product_reviews (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id  BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  rating      TINYINT UNSIGNED NOT NULL,  -- 1..5
  body        TEXT DEFAULT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_review_user_product (user_id, product_id),
  KEY idx_reviews_product_id (product_id),
  KEY idx_reviews_user_id (user_id),
  KEY idx_reviews_created_at (created_at),
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Зерновые данные (из скрина seed_products)
CREATE TABLE seed_products (
  id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title     VARCHAR(255) NOT NULL,
  category  VARCHAR(100) DEFAULT NULL,
  price     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  image     VARCHAR(512) DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- КОРЗИНА
-- =========================
CREATE TABLE cart_items (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  product_id  BIGINT UNSIGNED NOT NULL,
  qty         INT UNSIGNED NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_cart_user_product (user_id, product_id),
  KEY idx_cart_user_id (user_id),
  KEY idx_cart_product_id (product_id),
  CONSTRAINT fk_cart_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_cart_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- ЗАЯВКИ ПРОДАВЦОВ
-- =========================
CREATE TABLE seller_applications (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id          BIGINT UNSIGNED NOT NULL,
  company_name     VARCHAR(255) NOT NULL,
  tax_id           VARCHAR(64)  NOT NULL,
  price_list_url   VARCHAR(500) DEFAULT NULL,
  comment          TEXT DEFAULT NULL,

  status           ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  rejection_reason VARCHAR(500) DEFAULT NULL,
  decided_by       BIGINT UNSIGNED DEFAULT NULL,
  decided_at       DATETIME DEFAULT NULL,

  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uniq_seller_app_user (user_id),
  KEY idx_seller_app_status (status),
  KEY idx_seller_app_decided_at (decided_at),
  CONSTRAINT fk_seller_app_user  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_seller_app_admin FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- ЧАТЫ
-- =========================
CREATE TABLE chat_threads (
  id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  seller_id            BIGINT UNSIGNED NOT NULL,
  buyer_id             BIGINT UNSIGNED NOT NULL,
  archived_by_seller   TINYINT(1) NOT NULL DEFAULT 0,
  archived_by_buyer    TINYINT(1) NOT NULL DEFAULT 0,
  blocked_by_seller    TINYINT(1) NOT NULL DEFAULT 0,
  blocked_by_buyer     TINYINT(1) NOT NULL DEFAULT 0,
  muted_by_seller      TINYINT(1) NOT NULL DEFAULT 0,
  muted_by_buyer       TINYINT(1) NOT NULL DEFAULT 0,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_thread_pair (seller_id, buyer_id),
  KEY idx_thread_seller (seller_id),
  KEY idx_thread_buyer  (buyer_id),
  KEY idx_thread_updated_at (updated_at),
  CONSTRAINT fk_thread_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_thread_buyer  FOREIGN KEY (buyer_id)  REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chat_messages (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  thread_id        BIGINT UNSIGNED NOT NULL,
  sender_id        BIGINT UNSIGNED NOT NULL,
  body             TEXT,
  attachment_url   VARCHAR(255) DEFAULT NULL,
  attachment_name  VARCHAR(255) DEFAULT NULL,
  attachment_type  VARCHAR(64)  DEFAULT NULL,
  attachment_size  INT DEFAULT NULL,
  read_at          DATETIME DEFAULT NULL,
  edited_at        DATETIME DEFAULT NULL,
  deleted_at       DATETIME DEFAULT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_msg_thread_id (thread_id),
  KEY idx_msg_sender_id (sender_id),
  KEY idx_msg_created_at (created_at),
  KEY idx_msg_read_at (read_at),
  KEY idx_msg_deleted_at (deleted_at),
  CONSTRAINT fk_msg_thread FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- ЗАКАЗЫ И ОПЛАТЫ
-- =========================
CREATE TABLE orders (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       BIGINT UNSIGNED NOT NULL,
  status        ENUM('created','paid','cancelled','shipped','delivered','refunded') NOT NULL DEFAULT 'created', -- 'created','paid',... -> дополнил стандартные
  total_amount  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_orders_user_id (user_id),
  KEY idx_orders_status (status),
  KEY idx_orders_created_at (created_at),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_addresses (
  order_id     BIGINT UNSIGNED NOT NULL,
  country      VARCHAR(120) NOT NULL,
  city         VARCHAR(120) NOT NULL,
  street       VARCHAR(255) NOT NULL,
  postal_code  VARCHAR(32)  NOT NULL,
  PRIMARY KEY (order_id),
  CONSTRAINT fk_order_addr_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_items (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id    BIGINT UNSIGNED NOT NULL,
  product_id  BIGINT UNSIGNED NOT NULL,
  qty         INT UNSIGNED NOT NULL,
  price       DECIMAL(12,2) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_items_order_id (order_id),
  KEY idx_order_items_product_id (product_id),
  CONSTRAINT fk_oi_order   FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE payments (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id    BIGINT UNSIGNED NOT NULL,
  provider    VARCHAR(32) NOT NULL DEFAULT 'demo',
  status      ENUM('succeeded','failed','pending','canceled') NOT NULL DEFAULT 'succeeded', -- на скрине default 'succeeded'
  brand       VARCHAR(32) DEFAULT NULL,
  last4       VARCHAR(4)  DEFAULT NULL,
  amount      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payment_order_id (order_id),
  KEY idx_payment_status (status),
  CONSTRAINT fk_payment_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
