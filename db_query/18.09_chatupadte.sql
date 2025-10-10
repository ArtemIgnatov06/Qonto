USE myshopdb;

-- chat_messages: индексы, если отсутствуют
SET @schema = DATABASE();

-- idx_read_at
SELECT COUNT(*) INTO @has1
FROM information_schema.statistics
WHERE table_schema=@schema AND table_name='chat_messages' AND index_name='idx_read_at';
SET @sql1 = IF(@has1=0, 'CREATE INDEX idx_read_at ON chat_messages (read_at)', 'SELECT 1');
PREPARE s1 FROM @sql1; EXECUTE s1; DEALLOCATE PREPARE s1;

-- idx_thread_created
SELECT COUNT(*) INTO @has2
FROM information_schema.statistics
WHERE table_schema=@schema AND table_name='chat_messages' AND index_name='idx_thread_created';
SET @sql2 = IF(@has2=0, 'CREATE INDEX idx_thread_created ON chat_messages (thread_id, created_at)', 'SELECT 1');
PREPARE s2 FROM @sql2; EXECUTE s2; DEALLOCATE PREPARE s2;

------------------------------------------------------------------------------

-- Вложения у сообщений
ALTER TABLE chat_messages
  ADD COLUMN attachment_url   VARCHAR(255) NULL AFTER body,
  ADD COLUMN attachment_type  VARCHAR(64)  NULL AFTER attachment_url,
  ADD COLUMN attachment_name  VARCHAR(255) NULL AFTER attachment_type,
  ADD COLUMN attachment_size  INT          NULL AFTER attachment_name;

-- Архив/мут/блокировки и отдельные счётчики «заглушенных» непрочитанных
ALTER TABLE chat_threads
  ADD COLUMN archived_by_seller TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN archived_by_buyer  TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN muted_by_seller    TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN muted_by_buyer     TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN blocked_by_seller  TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN blocked_by_buyer   TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN muted_unread_seller INT NOT NULL DEFAULT 0,
  ADD COLUMN muted_unread_buyer  INT NOT NULL DEFAULT 0;

-- (опционально) индексы для фильтров
CREATE INDEX idx_threads_archived_seller ON chat_threads (seller_id, archived_by_seller);
CREATE INDEX idx_threads_archived_buyer  ON chat_threads (buyer_id,  archived_by_buyer);

ALTER TABLE chat_messages
  ADD COLUMN edited_at  DATETIME NULL AFTER read_at,
  ADD COLUMN deleted_at DATETIME NULL AFTER edited_at;
