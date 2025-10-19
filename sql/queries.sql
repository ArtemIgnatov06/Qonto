-- name: select_general
SELECT DATABASE() AS db;

-- name: select_information_schema
SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'contact_email';

-- name: alter_general
ALTER TABLE users ADD COLUMN contact_email VARCHAR(255) NULL AFTER email;

-- name: select_information_schema_02
SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar_url';

-- name: alter_general_02
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(512) NULL AFTER contact_email;

-- name: select_users
SELECT id, first_name, last_name, username, phone, email, contact_email, avatar_url, role, seller_status, seller_rejection_reason FROM users WHERE id=? LIMIT 1;

-- name: select_users_02
SELECT * FROM users WHERE email = ? LIMIT 1;

-- name: select_users_03
SELECT * FROM users WHERE phone = ? LIMIT 1;

-- name: select_users_04
SELECT id FROM users WHERE username = ? LIMIT 1;

-- name: insert_general
INSERT INTO users (first_name, last_name, username, password_hash, phone, email)
     VALUES (?, ?, ?, ?, ?, ?);

-- name: create_general
CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- name: select_information_schema_03
SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'category';

-- name: alter_general_03
ALTER TABLE products ADD COLUMN category VARCHAR(100) NOT NULL DEFAULT '' AFTER description;

-- name: select_information_schema_04
SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'status';

-- name: alter_general_04
ALTER TABLE products ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active' AFTER qty;

-- name: select_information_schema_05
SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'created_at';

-- name: alter_general_05
ALTER TABLE products ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- name: select_information_schema_06
SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'preview_image_url';

-- name: alter_general_06
ALTER TABLE products ADD COLUMN preview_image_url VARCHAR(500) NULL DEFAULT NULL AFTER status;

-- name: select_information_schema_07
SELECT COUNT(*) AS cnt FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_category';

-- name: select_information_schema_08
SELECT COUNT(*) AS cnt FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_created_at';

-- name: create_general_02
CREATE TABLE IF NOT EXISTS email_otps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- name: create_general_03
CREATE TABLE IF NOT EXISTS phone_otps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        phone VARCHAR(64) NOT NULL,
        code_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_phone (phone)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- name: select_users_05
SELECT id FROM users WHERE username = ? OR email = ?;

-- name: insert_general_02
INSERT INTO users (first_name, last_name, username, password_hash, phone, email)
       VALUES (?, ?, ?, ?, ?, ?);

-- name: select_users_06
SELECT * FROM users WHERE username = ? LIMIT 1;

-- name: select_users_07
SELECT id FROM users WHERE email = ? LIMIT 1;

-- name: select_users_08
SELECT id FROM users WHERE phone = ? LIMIT 1;

-- name: select_users_09
SELECT id FROM users WHERE email=? LIMIT 1;

-- name: select_users_10
SELECT id FROM users WHERE phone=? LIMIT 1;

-- name: insert_general_03
INSERT INTO email_otps (email, code_hash, expires_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE code_hash=VALUES(code_hash), expires_at=VALUES(expires_at), created_at=CURRENT_TIMESTAMP;

-- name: select_email_otps
SELECT * FROM email_otps WHERE email=? LIMIT 1;

-- name: delete_email_otps
DELETE FROM email_otps WHERE email=?;

-- name: insert_general_04
INSERT INTO email_otps (email, code_hash, expires_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE code_hash = VALUES(code_hash), expires_at = VALUES(expires_at), created_at = CURRENT_TIMESTAMP;

-- name: select_email_otps_02
SELECT * FROM email_otps WHERE email = ? LIMIT 1;

-- name: delete_email_otps_02
DELETE FROM email_otps WHERE email = ?;

-- name: select_users_11
SELECT id FROM users WHERE phone = ? AND id <> ? LIMIT 1;

-- name: update_general
UPDATE users SET phone = ?, password_hash = ? WHERE id = ?;

-- name: update_general_02
UPDATE users SET phone = ? WHERE id = ?;

-- name: select_phone_otps
SELECT created_at FROM phone_otps WHERE phone=?;

-- name: insert_general_05
INSERT INTO phone_otps (phone, code_hash, expires_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE code_hash = VALUES(code_hash), expires_at = VALUES(expires_at), created_at = CURRENT_TIMESTAMP;

-- name: select_phone_otps_02
SELECT * FROM phone_otps WHERE phone = ? LIMIT 1;

-- name: delete_phone_otps
DELETE FROM phone_otps WHERE phone = ?;

-- name: select_users_12
SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1;

-- name: update_general_03
UPDATE users SET first_name=?, last_name=?, email=?, contact_email=? WHERE id=?;

-- name: update_general_04
UPDATE users SET last_seen_at = NOW() WHERE id = ?;

-- name: select_users_13
SELECT id FROM users WHERE id=? LIMIT 1;

-- name: select_chat_threads
SELECT id FROM chat_threads WHERE seller_id=? AND buyer_id=? LIMIT 1;

-- name: insert_general_06
INSERT IGNORE INTO chat_threads (seller_id, buyer_id) VALUES (?, ?);

-- name: select_chat_threads_02
SELECT * FROM chat_threads WHERE id=? LIMIT 1;

-- name: insert_general_07
INSERT INTO chat_messages (thread_id, sender_id, body)
         VALUES (?, ?, ?);

-- name: insert_general_08
INSERT INTO chat_messages
           (thread_id, sender_id, body, attachment_url, attachment_type, attachment_name, attachment_size)
         VALUES (?, ?, ?, ?, ?, ?, ?);

-- name: update_general_05
UPDATE chat_threads SET muted_unread_seller = muted_unread_seller + ? WHERE id=?;

-- name: update_general_06
UPDATE chat_threads SET muted_unread_buyer = muted_unread_buyer + ? WHERE id=?;

-- name: update_general_07
UPDATE chat_threads SET ${cols.archived}=? WHERE id=?;

-- name: update_general_08
UPDATE chat_threads SET ${cols.muted}=? WHERE id=?;

-- name: update_general_09
UPDATE chat_threads SET ${cols.muted_unread}=0 WHERE id=?;

-- name: update_general_10
UPDATE chat_threads SET ${cols.blocked}=? WHERE id=?;

-- name: select_chat_messages
SELECT COUNT(*) AS c
         FROM chat_messages m
         JOIN chat_threads t ON t.id=m.thread_id
        WHERE (t.seller_id=? OR t.buyer_id=?)
          AND m.sender_id<>?
          AND m.read_at IS NULL;

-- name: select_chat_threads_03
SELECT * FROM chat_threads WHERE id=? AND (seller_id=? OR buyer_id=?);

-- name: select_chat_messages_02
SELECT id, thread_id, sender_id, body, attachment_url, attachment_type,
              attachment_name, attachment_size, created_at, read_at, edited_at, deleted_at
       FROM chat_messages
       WHERE thread_id=?
       ORDER BY created_at ASC;

-- name: select_chat_messages_03
SELECT m.*, t.seller_id, t.buyer_id
       FROM chat_messages m
       JOIN chat_threads t ON t.id = m.thread_id
       WHERE m.id=? LIMIT 1;

-- name: update_general_11
UPDATE chat_messages SET body=?, edited_at=NOW() WHERE id=?;

-- name: select_chat_messages_04
SELECT id, thread_id, sender_id, body, attachment_url, attachment_type,
              attachment_name, attachment_size, created_at, read_at, edited_at, deleted_at
       FROM chat_messages WHERE id=?;

-- name: update_general_12
UPDATE chat_messages
         SET attachment_url=NULL,
             attachment_type=NULL,
             attachment_name=NULL,
             attachment_size=NULL,
             edited_at=NULL,
             deleted_at=NOW(),
             body=''
       WHERE id=?;

-- name: select_categories
SELECT id, name FROM categories ORDER BY name ASC;

-- name: insert_general_09
INSERT INTO categories (name) VALUES (?);

-- name: select_categories_02
SELECT id, name FROM categories WHERE name = ? LIMIT 1;

-- name: select_categories_03
SELECT id FROM categories WHERE name = ? LIMIT 1;

-- name: insert_general_10
INSERT INTO products (seller_id, title, description, price, qty, category, status, preview_image_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, NOW());

-- name: select_products
SELECT p.id, p.title, p.description, p.price, p.qty, p.category, p.status, p.created_at, p.preview_image_url
       FROM products p
       WHERE p.seller_id = ?
       ORDER BY p.created_at DESC;

-- name: update_general_13
UPDATE products SET title = ?, description = ?, price = ?, qty = ?, category = ?
       WHERE id = ? AND seller_id = ?;

-- name: delete_products
DELETE FROM products WHERE id = ? AND seller_id = ?;

-- name: select_products_02
SELECT id, seller_id, title, price, category FROM products WHERE id = ?;

-- name: insert_general_11
INSERT INTO product_deletions (product_id, seller_id, title, price, category, admin_id, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?);

-- name: delete_products_02
DELETE FROM products WHERE id = ?;

-- name: select_product_reviews
SELECT r.id, r.rating, r.comment, r.created_at, r.updated_at, r.user_id,
             TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS user_name, u.username
      FROM product_reviews r
      JOIN users u ON u.id = r.user_id
      WHERE r.product_id = ?
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT ? OFFSET ?;

-- name: insert_general_12
INSERT INTO product_reviews (product_id, user_id, rating, comment)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rating=VALUES(rating), comment=VALUES(comment), updated_at=CURRENT_TIMESTAMP;

-- name: select_product_reviews_02
SELECT r.id, r.rating, r.comment, r.created_at, r.updated_at, r.user_id,
              TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS user_name, u.username
       FROM product_reviews r
       JOIN users u ON u.id = r.user_id
       WHERE r.product_id = ? AND r.user_id = ?
       ORDER BY r.updated_at DESC, r.id DESC
       LIMIT 1;

-- name: select_cart_items
SELECT ci.product_id, ci.qty, p.title, p.price, p.preview_image_url, p.image_url
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      WHERE ci.user_id = ?
      ORDER BY ci.updated_at DESC, ci.id DESC;

-- name: insert_general_13
INSERT INTO cart_items (user_id, product_id, qty)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty), updated_at = CURRENT_TIMESTAMP;

-- name: delete_cart_items
DELETE FROM cart_items WHERE user_id=? AND product_id=?;

-- name: update_general_14
UPDATE cart_items SET qty=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND product_id=?;

-- name: select_cart_items_02
SELECT ci.product_id, ci.qty, p.price
       FROM cart_items ci JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = ?;

-- name: insert_general_14
INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, 'created');

-- name: insert_general_15
INSERT INTO order_items (order_id, product_id, qty, price) VALUES ?;

-- name: insert_general_16
INSERT INTO order_addresses (order_id, country, city, street, postal_code) VALUES (?, ?, ?, ?, ?);

-- name: update_general_15
UPDATE orders SET status='paid' WHERE id=?;

-- name: insert_general_17
INSERT INTO payments (order_id, provider, brand, last4, status) VALUES (?, 'demo', ?, ?, 'succeeded');

-- name: delete_cart_items_02
DELETE FROM cart_items WHERE user_id=?;

-- name: alter_general_07
ALTER TABLE users ADD COLUMN last_seen_at DATETIME NULL, ADD INDEX idx_last_seen (last_seen_at);

-- name: create_general_04
CREATE TABLE IF NOT EXISTS chat_threads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        seller_id INT NOT NULL,
        buyer_id INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_pair (seller_id, buyer_id),
        INDEX idx_seller (seller_id, updated_at),
        INDEX idx_buyer (buyer_id, updated_at),
        CONSTRAINT fk_chat_threads_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_chat_threads_buyer  FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- name: create_general_05
CREATE TABLE IF NOT EXISTS chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        thread_id INT NOT NULL,
        sender_id INT NOT NULL,
        body TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        read_at DATETIME NULL,
        INDEX idx_thread_created (thread_id, created_at),
        CONSTRAINT fk_chat_messages_thread FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE,
        CONSTRAINT fk_chat_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- name: select_users_14
SELECT id, first_name, last_name, contact_email, avatar_url, last_seen_at
         FROM users WHERE id=? LIMIT 1;

-- name: select_product_reviews_03
SELECT ROUND(AVG(r.rating), 2) AS rating
         FROM product_reviews r
         JOIN products p ON p.id = r.product_id
        WHERE p.seller_id = ?;

-- name: select_order_items
SELECT COALESCE(SUM(oi.qty),0) AS soldCount
         FROM order_items oi
         JOIN orders o   ON o.id = oi.order_id
         JOIN products p ON p.id = oi.product_id
        WHERE p.seller_id = ? AND o.status IN ('paid','completed');

-- name: update_general_16
UPDATE users SET avatar_url=? WHERE id=?;
