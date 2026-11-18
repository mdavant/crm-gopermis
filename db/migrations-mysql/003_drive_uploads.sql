-- Migration 003 : envois de fichiers par morceaux (Drive) et index corbeille.
CREATE TABLE IF NOT EXISTS drive_uploads (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  parent_id CHAR(36) NULL,
  name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  size BIGINT UNSIGNED NOT NULL,
  received BIGINT UNSIGNED NOT NULL DEFAULT 0,
  temp_path VARCHAR(512) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_drive_uploads_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
