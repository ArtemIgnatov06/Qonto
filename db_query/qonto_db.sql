-- 0) База
CREATE DATABASE IF NOT EXISTS `myshopdb`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
USE `myshopdb`;

--
--  Смена пароля:
-- -ALTER USER 'root'@'localhost' IDENTIFIED BY 'rootpassword';
-- FLUSH PRIVILEGES;
--

-- 1) Служебные таблицы для OTP
CREATE TABLE IF NOT EXISTS `email_otps` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `otp` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phone_otps` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `phone` VARCHAR(20) NOT NULL,
  `otp` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Пользователи
CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `first_name`  VARCHAR(100) NOT NULL DEFAULT '',
  `last_name`   VARCHAR(100) NOT NULL DEFAULT '',
  `username`    VARCHAR(100) NOT NULL,
  `email`       VARCHAR(255) DEFAULT NULL,
  `phone`       VARCHAR(20)  DEFAULT NULL,

  `password_hash` VARCHAR(255) NOT NULL,

  `failed_login_attempts` INT UNSIGNED NOT NULL DEFAULT 0,

  `email_verification_code`        INT UNSIGNED DEFAULT NULL,
  `email_verification_code_expires_at` DATETIME DEFAULT NULL,
  `email_verified_at`              DATETIME DEFAULT NULL,

  `login_otp_code`                 INT UNSIGNED DEFAULT NULL,
  `login_otp_code_expires_at`      DATETIME DEFAULT NULL,

  `phone_verified_at`              DATETIME DEFAULT NULL,
  `last_login_at`                  DATETIME DEFAULT NULL,

  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2.1) На случай если таблица уже была и id был SIGNED — жёстко приводим к UNSIGNED,
-- это устраняет твою ошибку 3780 (несовместимость типов при FK).
ALTER TABLE `users`
  MODIFY `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT;

-- 2.2) Добавляем поля ролей и статуса продавца
-- (если уже добавлял раньше — просто пропусти блок или выполни по одному)
ALTER TABLE `users`
  ADD COLUMN `role` ENUM('user','admin') NOT NULL DEFAULT 'user' AFTER `username`,
  ADD COLUMN `seller_status` ENUM('none','pending','approved','rejected') NOT NULL DEFAULT 'none' AFTER `phone`,
  ADD COLUMN `seller_rejection_reason` VARCHAR(500) NULL DEFAULT NULL AFTER `seller_status`;

-- 3) Таблица заявок на продавца
CREATE TABLE IF NOT EXISTS `seller_applications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,               -- FK на users.id (UNSIGNED!)
  `company_name` VARCHAR(255) NOT NULL,
  `tax_id` VARCHAR(64) NOT NULL,
  `price_list_url` VARCHAR(500) DEFAULT NULL,
  `comment` TEXT DEFAULT NULL,
  `status` ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `decided_at` DATETIME DEFAULT NULL,
  `decided_by` BIGINT UNSIGNED DEFAULT NULL,        -- админ, принявший решение
  `rejection_reason` VARCHAR(500) DEFAULT NULL,

  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_decided_by` (`decided_by`),

  CONSTRAINT `fk_seller_applications_user`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,

  CONSTRAINT `fk_seller_applications_decided_by`
    FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) Товары (создавать сможет только approved-продавец)
CREATE TABLE IF NOT EXISTS `products` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `seller_id` BIGINT UNSIGNED NOT NULL,             -- FK на users.id
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `price` DECIMAL(12,2) NOT NULL,
  `qty` INT NOT NULL DEFAULT 0,
  `status` ENUM('draft','active','archived') NOT NULL DEFAULT 'active',

  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_seller` (`seller_id`),

  CONSTRAINT `fk_products_seller`
    FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5) Сделать себя админом (подставь свой email/username/id)
UPDATE `users` SET role='admin' WHERE email='ignatov051@gmail.com';
UPDATE `users` SET role='admin' WHERE email='u5585103@live.warwick.ac.uk';