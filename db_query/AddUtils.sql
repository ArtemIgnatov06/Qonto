USE `myshopdb`;

-- На всякий случай убедимся, что мы в нужной БД
SELECT DATABASE();

-- 1) Создадим таблицу заявок, если её нет
CREATE TABLE IF NOT EXISTS `seller_applications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `company_name` VARCHAR(255) NOT NULL,
  `tax_id` VARCHAR(64) NOT NULL,
  `price_list_url` VARCHAR(500) DEFAULT NULL,
  `comment` TEXT DEFAULT NULL,
  `status` ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `decided_at` DATETIME DEFAULT NULL,
  `decided_by` BIGINT UNSIGNED DEFAULT NULL,
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

-- Проверим, что таблица появилась
SHOW TABLES LIKE 'seller_applications';

-- 2) Два тестовых пользователя (если уже есть — не меняем)
INSERT INTO users (first_name, last_name, username, email, phone, password_hash)
VALUES
  ('Ivan',  'Petrenko', 'ivan_seller',  'ivan.seller@test.local',  '+380501111111', ''),
  ('Olena', 'Kovalenko','olena_seller', 'olena.seller@test.local', '+380671234567', '')
ON DUPLICATE KEY UPDATE id = id;

-- 3) Проставим статус продавца = pending
UPDATE users
SET seller_status = 'pending', seller_rejection_reason = NULL
WHERE email IN ('ivan.seller@test.local', 'olena.seller@test.local');

-- 4) Добавим две заявки (pending)
INSERT INTO seller_applications (user_id, company_name, tax_id, price_list_url, comment, status)
SELECT u.id, 'IvanShop LLC',  '12345678', 'https://example.com/ivan-price.xlsx', 'Хочу продавать электронику', 'pending'
FROM users u WHERE u.email = 'ivan.seller@test.local'
UNION ALL
SELECT u.id, 'OlenaMarket',   '87654321', NULL,                                  'Готова загрузить прайс после одобрения', 'pending'
FROM users u WHERE u.email = 'olena.seller@test.local';

-- 5) Посмотрим, что получилось
SELECT a.id, a.user_id, a.company_name, a.tax_id, a.status, a.created_at,
       u.first_name, u.last_name, u.email
FROM seller_applications a
JOIN users u ON u.id = a.user_id
WHERE u.email IN ('ivan.seller@test.local', 'olena.seller@test.local')
ORDER BY a.created_at DESC;




-- создаём демо-продавца, если уже есть — просто обновим статус
INSERT INTO users (
  first_name, last_name, username, email, phone, password_hash,
  role, seller_status, created_at, updated_at
) VALUES (
  'Иван', 'Продавец', 'ivan_seller', 'ivan@example.com', 123123312, '',
  'user', 'approved', NOW(), NOW()
)
ON DUPLICATE KEY UPDATE
  seller_status = 'approved';

-- возьмём его id (точно не NULL)
SET @seller_id := (SELECT id FROM users WHERE username='ivan_seller' LIMIT 1);

-- на всякий случай посмотрим, что получили
SELECT @seller_id AS seller_id, username, seller_status
FROM users WHERE id=@seller_id;

START TRANSACTION;

INSERT INTO products (seller_id, title, description, price, qty, status) VALUES
(@seller_id, 'USB-C кабель 1м', 'Плетёная оплётка, быстрая зарядка', 390.00, 50, 'active'),
(@seller_id, 'Защитное стекло', '2.5D, олеофобное покрытие', 290.00, 80, 'active');

COMMIT;

-- проверим, что появились
SELECT id, seller_id, title, price, qty, status FROM products ORDER BY id DESC LIMIT 10;
