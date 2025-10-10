UPDATE products
SET qty = 1, status = 'active'
-- WHERE id = :id;
;

CREATE TABLE IF NOT EXISTS product_deletions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  seller_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  category VARCHAR(100) NOT NULL,
  admin_id INT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pd_product_id (product_id),
  INDEX idx_pd_admin_id (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;