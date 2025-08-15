USE `myshopdb`;

-- 1) Создадим двух тестовых пользователей (если их ещё нет)
INSERT INTO users (first_name, last_name, username, email, phone, password_hash)
VALUES
  ('Ivan',  'Petrenko', 'ivan_seller',  'ivan.seller@test.local',  '+380501111111', ''),
  ('Olena', 'Kovalenko','olena_seller', 'olena.seller@test.local', '+380671234567', '')
ON DUPLICATE KEY UPDATE id = id;  -- ничего не меняем, если email/username уже есть

-- 2) Получим их id
SELECT id, username, email FROM users
WHERE email IN ('ivan.seller@test.local', 'olena.seller@test.local');

-- ⚠️ Подставь сюда фактические id из результата SELECT (если нужно).
-- Ниже я предполагаю, что они, например, 101 и 102. Исправь числа при необходимости!

-- 3) Проставим статус продавца = pending у этих пользователей
UPDATE users SET seller_status = 'pending', seller_rejection_reason = NULL
WHERE email IN ('ivan.seller@test.local', 'olena.seller@test.local');

-- 4) Добавим сами заявки в seller_applications (в статусе pending)
INSERT INTO seller_applications
(user_id, company_name, tax_id, price_list_url, comment, status)
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
