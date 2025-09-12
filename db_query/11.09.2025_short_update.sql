ALTER TABLE users
  ADD COLUMN contact_email VARCHAR(255) NULL AFTER email,
  ADD COLUMN avatar_url VARCHAR(512) NULL AFTER contact_email;