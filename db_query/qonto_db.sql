-- Создаём БД
CREATE DATABASE IF NOT EXISTS `myshopdb`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `myshopdb`;

--Смена пароля:
--ALTER USER 'root'@'localhost' IDENTIFIED BY 'rootpassword';
--FLUSH PRIVILEGES;
--

-- =========================
-- 1) email_otps
-- =========================
CREATE TABLE IF NOT EXISTS `email_otps` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `otp` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL
      DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_email` (`email`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 2) phone_otps
-- =========================
CREATE TABLE IF NOT EXISTS `phone_otps` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `phone` VARCHAR(20) NOT NULL,
  `otp` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL
      DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_phone` (`phone`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 3) users
-- =========================
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
  `updated_at` TIMESTAMP NOT NULL
      DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 4) users_backup
--    (структурная копия users на момент бэкапа)
-- =========================
CREATE TABLE IF NOT EXISTS `users_backup` (
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
  `updated_at` TIMESTAMP NOT NULL
      DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- (опционально) пользователь и права
-- Замените 'myshop' и 'STRONG_PASSWORD' своими значениями.
-- CREATE USER IF NOT EXISTS 'myshop'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD';
-- GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER
--   ON `myshopdb`.* TO 'myshop'@'localhost';
-- FLUSH PRIVILEGES;

--Смена пароля:
--ALTER USER 'root'@'localhost' IDENTIFIED BY 'rootpassword';
--FLUSH PRIVILEGES;
--