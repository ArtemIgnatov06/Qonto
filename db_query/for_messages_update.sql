USE myshopdb;

-- чистим, если были частичные попытки
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_threads;

-- диалоги: seller_id/buyer_id = BIGINT UNSIGNED (как users.id)
CREATE TABLE chat_threads (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  seller_id BIGINT UNSIGNED NOT NULL,
  buyer_id  BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_pair (seller_id, buyer_id),
  INDEX idx_seller (seller_id, updated_at),
  INDEX idx_buyer  (buyer_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- сообщения: sender_id = BIGINT UNSIGNED, thread_id ссылается на chat_threads.id (INT UNSIGNED)
CREATE TABLE chat_messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  thread_id INT UNSIGNED NOT NULL,
  sender_id BIGINT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  INDEX idx_thread_created (thread_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- вешаем внешние ключи
ALTER TABLE chat_threads
  ADD CONSTRAINT fk_chat_threads_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_chat_threads_buyer  FOREIGN KEY (buyer_id)  REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE chat_messages
  ADD CONSTRAINT fk_chat_messages_thread FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_chat_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;


-- Добавляем колонку last_seen_at безопасно (через dynamic SQL)
SET @has_col := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'last_seen_at'
);
SET @sql := IF(@has_col = 0,
  'ALTER TABLE `users` ADD COLUMN `last_seen_at` DATETIME NULL, ADD INDEX `idx_last_seen` (`last_seen_at`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Диалоги
CREATE TABLE IF NOT EXISTS chat_threads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  seller_id INT NOT NULL,
  buyer_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_pair (seller_id, buyer_id),
  INDEX idx_seller (seller_id, updated_at),
  INDEX idx_buyer (buyer_id, updated_at),
  CONSTRAINT fk_chat_threads_seller
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_threads_buyer
    FOREIGN KEY (buyer_id)  REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Сообщения
CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  thread_id INT NOT NULL,
  sender_id INT NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  INDEX idx_thread_created (thread_id, created_at),
  CONSTRAINT fk_chat_messages_thread
    FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_messages_sender
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
