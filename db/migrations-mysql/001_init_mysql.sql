-- Migration 001: Schéma complet GoPermis CRM pour MySQL 8 / MariaDB
-- Aucune suppression de base ou de table existante.

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL DEFAULT '',
  name VARCHAR(205) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'manager', 'instructor', 'staff') NOT NULL DEFAULT 'staff',
  role_preset VARCHAR(50) NOT NULL DEFAULT 'instructor',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  last_login_at DATETIME(3) NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  temp_password VARCHAR(64) NULL,
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_name ENUM('admin', 'manager', 'instructor', 'staff') NOT NULL,
  permission_name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (role_name, permission_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_permissions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  permission_name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_user_permissions_pair (user_id, permission_name),
  KEY idx_user_permissions_user (user_id),
  CONSTRAINT fk_user_permissions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_auth_sessions_user (user_id),
  KEY idx_auth_sessions_expires (expires_at),
  CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (
  attempt_key VARCHAR(128) NOT NULL PRIMARY KEY,
  attempts INT NOT NULL DEFAULT 0,
  window_start DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clients (
  id CHAR(36) NOT NULL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NULL,
  phone VARCHAR(30) NOT NULL,
  address VARCHAR(255) NULL,
  source VARCHAR(100) NOT NULL DEFAULT 'Saisie manuelle',
  status ENUM('Prospect', 'Actif', 'Terminé', 'Archivé') NOT NULL DEFAULT 'Prospect',
  notes TEXT NULL,
  version INT NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_clients_created (created_at, id),
  KEY idx_clients_email (email),
  KEY idx_clients_phone (phone),
  KEY idx_clients_status (status),
  KEY idx_clients_name (last_name, first_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_folders (
  id CHAR(36) NOT NULL PRIMARY KEY,
  client_id CHAR(36) NOT NULL,
  parent_id CHAR(36) NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_client_folders_client (client_id),
  KEY idx_client_folders_parent (parent_id),
  CONSTRAINT fk_client_folders_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_client_folders_parent FOREIGN KEY (parent_id) REFERENCES client_folders(id) ON DELETE CASCADE,
  CONSTRAINT fk_client_folders_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vehicle_models (
  id VARCHAR(80) NOT NULL PRIMARY KEY,
  label VARCHAR(150) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vehicles (
  id CHAR(36) NOT NULL PRIMARY KEY,
  model_id VARCHAR(80) NOT NULL,
  registration_number VARCHAR(32) NULL,
  brand VARCHAR(100) NULL,
  model VARCHAR(100) NULL,
  year SMALLINT NULL,
  label VARCHAR(120) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'active',
  active TINYINT(1) NOT NULL DEFAULT 1,
  notes TEXT NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_vehicles_label (label),
  UNIQUE KEY uq_vehicles_registration (registration_number),
  KEY idx_vehicles_model (model_id),
  KEY idx_vehicles_active (active),
  CONSTRAINT fk_vehicles_model FOREIGN KEY (model_id) REFERENCES vehicle_models(id),
  CONSTRAINT fk_vehicles_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS instructors (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL DEFAULT '',
  name VARCHAR(205) NOT NULL,
  email VARCHAR(254) NULL,
  phone VARCHAR(30) NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'active',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_instructors_user (user_id),
  KEY idx_instructors_active (active),
  CONSTRAINT fk_instructors_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_instructors_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_types (
  id VARCHAR(80) NOT NULL PRIMARY KEY,
  label VARCHAR(150) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  pricing_mode ENUM('hourly', 'quote') NOT NULL DEFAULT 'hourly'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tariff_versions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  model VARCHAR(80) NOT NULL,
  support ENUM('GoPermis', 'Personnel') NOT NULL,
  cents INT NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE NULL,
  UNIQUE KEY uq_tariff_version (model, support, valid_from),
  CONSTRAINT fk_tariff_model FOREIGN KEY (model) REFERENCES vehicle_models(id),
  CONSTRAINT chk_tariff_cents CHECK (cents > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS offers (
  id VARCHAR(80) NOT NULL PRIMARY KEY,
  label VARCHAR(150) NOT NULL,
  paid_minutes INT NOT NULL,
  bonus_minutes INT NOT NULL DEFAULT 0,
  single_payment TINYINT(1) NOT NULL DEFAULT 1,
  active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS services (
  id CHAR(36) NOT NULL PRIMARY KEY,
  client_id CHAR(36) NOT NULL,
  type_id VARCHAR(80) NOT NULL,
  status ENUM('Brouillon', 'Active', 'Terminée') NOT NULL DEFAULT 'Active',
  price_snapshot JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_services_client (client_id),
  CONSTRAINT fk_services_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_services_type FOREIGN KEY (type_id) REFERENCES service_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  service_id CHAR(36) NOT NULL,
  amount_cents INT NOT NULL,
  method ENUM('Carte', 'Virement', 'Espèces') NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  request_id CHAR(36) NOT NULL,
  UNIQUE KEY uq_payments_request (request_id),
  KEY idx_payments_service (service_id),
  CONSTRAINT fk_payments_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_user FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_payments_amount CHECK (amount_cents > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS scheduling_policy (
  id TINYINT(1) NOT NULL PRIMARY KEY,
  credit_policy ENUM('reserve_credit', 'credit_on_completion') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bookings (
  id CHAR(36) NOT NULL PRIMARY KEY,
  service_id CHAR(36) NULL,
  client_id CHAR(36) NOT NULL,
  vehicle_id CHAR(36) NOT NULL,
  instructor_id CHAR(36) NULL,
  start_at DATETIME(3) NOT NULL,
  end_at DATETIME(3) NOT NULL,
  minutes INT NOT NULL,
  status ENUM('confirmed', 'completed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  notes TEXT NULL,
  companion_name VARCHAR(150) NULL,
  companion_license_date DATE NULL,
  request_id CHAR(36) NOT NULL,
  created_by CHAR(36) NOT NULL,
  completed_by CHAR(36) NULL,
  completed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_bookings_request (request_id),
  KEY idx_bookings_interval (start_at, end_at),
  KEY idx_bookings_service (service_id, status),
  KEY idx_bookings_client (client_id, start_at),
  KEY idx_bookings_vehicle (vehicle_id, start_at, end_at),
  KEY idx_bookings_instructor (instructor_id, start_at, end_at),
  CONSTRAINT fk_bookings_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
  CONSTRAINT fk_bookings_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_bookings_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  CONSTRAINT fk_bookings_instructor FOREIGN KEY (instructor_id) REFERENCES instructors(id),
  CONSTRAINT fk_bookings_creator FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_bookings_completer FOREIGN KEY (completed_by) REFERENCES users(id),
  CONSTRAINT chk_bookings_minutes CHECK (minutes > 0),
  CONSTRAINT chk_bookings_dates CHECK (end_at > start_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hour_ledger (
  id CHAR(36) NOT NULL PRIMARY KEY,
  service_id CHAR(36) NOT NULL,
  booking_id CHAR(36) NULL,
  minutes INT NOT NULL,
  kind ENUM('purchase', 'bonus', 'session', 'adjustment') NOT NULL,
  reason VARCHAR(255) NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_hour_ledger_booking (booking_id),
  KEY idx_hour_ledger_service (service_id),
  CONSTRAINT fk_hour_ledger_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  CONSTRAINT fk_hour_ledger_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
  CONSTRAINT fk_hour_ledger_user FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_hour_ledger_nonzero CHECK (minutes <> 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_notes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  client_id CHAR(36) NOT NULL,
  body TEXT NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_client_notes_client (client_id, created_at),
  CONSTRAINT fk_client_notes_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_client_notes_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS unavailabilities (
  id CHAR(36) NOT NULL PRIMARY KEY,
  kind ENUM('vehicle', 'instructor', 'client') NOT NULL,
  vehicle_id CHAR(36) NULL,
  instructor_id CHAR(36) NULL,
  client_id CHAR(36) NULL,
  reason VARCHAR(500) NOT NULL,
  starts_at DATETIME(3) NOT NULL,
  ends_at DATETIME(3) NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  released_at DATETIME(3) NULL,
  released_by CHAR(36) NULL,
  KEY idx_unavail_vehicle (vehicle_id, starts_at, ends_at),
  KEY idx_unavail_instructor (instructor_id, starts_at, ends_at),
  KEY idx_unavail_client (client_id, starts_at, ends_at),
  CONSTRAINT fk_unavail_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  CONSTRAINT fk_unavail_instructor FOREIGN KEY (instructor_id) REFERENCES instructors(id),
  CONSTRAINT fk_unavail_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_unavail_creator FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_unavail_releaser FOREIGN KEY (released_by) REFERENCES users(id),
  CONSTRAINT chk_unavail_dates CHECK (ends_at > starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS documents (
  id CHAR(36) NOT NULL PRIMARY KEY,
  client_id CHAR(36) NULL,
  folder_id CHAR(36) NULL,
  uploaded_by CHAR(36) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  storage_path VARCHAR(512) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  is_private TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_documents_stored (stored_name),
  KEY idx_documents_client (client_id),
  KEY idx_documents_folder (folder_id),
  KEY idx_documents_uploader (uploaded_by),
  CONSTRAINT fk_documents_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_documents_folder FOREIGN KEY (folder_id) REFERENCES client_folders(id) ON DELETE SET NULL,
  CONSTRAINT fk_documents_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS drive_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  parent_id CHAR(36) NULL,
  document_id CHAR(36) NULL,
  name VARCHAR(255) NOT NULL,
  type ENUM('folder', 'file') NOT NULL,
  mime_type VARCHAR(150) NULL,
  size BIGINT UNSIGNED NOT NULL DEFAULT 0,
  storage_path VARCHAR(512) NULL,
  starred TINYINT(1) NOT NULL DEFAULT 0,
  color VARCHAR(32) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by CHAR(36) NULL,
  KEY idx_drive_items_parent (parent_id),
  KEY idx_drive_items_type (type),
  KEY idx_drive_items_name (name),
  CONSTRAINT fk_drive_items_parent FOREIGN KEY (parent_id) REFERENCES drive_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_drive_items_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL,
  CONSTRAINT fk_drive_items_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  details JSON NULL,
  ip_address VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_user (user_id, created_at),
  KEY idx_audit_created (created_at),
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Référentiel initial (idempotent)
INSERT IGNORE INTO role_permissions (role_name, permission_name) VALUES
  ('admin', 'admin.full'),
  ('admin', 'clients.read'),
  ('admin', 'clients.write'),
  ('admin', 'clients.view'),
  ('admin', 'clients.create'),
  ('admin', 'clients.edit'),
  ('admin', 'services.write'),
  ('admin', 'payments.read'),
  ('admin', 'payments.write'),
  ('admin', 'audit.read'),
  ('admin', 'schedule.read'),
  ('admin', 'schedule.write'),
  ('admin', 'planning.create'),
  ('admin', 'sessions.complete'),
  ('admin', 'resources.write'),
  ('admin', 'catalog.write'),
  ('admin', 'catalog.edit'),
  ('admin', 'drive.all'),
  ('admin', 'documents.read'),
  ('admin', 'documents.write'),

  ('manager', 'clients.read'),
  ('manager', 'clients.write'),
  ('manager', 'clients.view'),
  ('manager', 'clients.create'),
  ('manager', 'clients.edit'),
  ('manager', 'services.write'),
  ('manager', 'payments.read'),
  ('manager', 'payments.write'),
  ('manager', 'audit.read'),
  ('manager', 'schedule.read'),
  ('manager', 'schedule.write'),
  ('manager', 'planning.create'),
  ('manager', 'sessions.complete'),
  ('manager', 'resources.write'),
  ('manager', 'drive.all'),
  ('manager', 'documents.read'),
  ('manager', 'documents.write'),

  ('staff', 'clients.read'),
  ('staff', 'clients.write'),
  ('staff', 'clients.view'),
  ('staff', 'clients.create'),
  ('staff', 'clients.edit'),
  ('staff', 'services.write'),
  ('staff', 'payments.read'),
  ('staff', 'payments.write'),
  ('staff', 'schedule.read'),
  ('staff', 'schedule.write'),
  ('staff', 'planning.create'),
  ('staff', 'documents.read'),
  ('staff', 'documents.write'),

  ('instructor', 'clients.read'),
  ('instructor', 'clients.view'),
  ('instructor', 'schedule.read'),
  ('instructor', 'schedule.write'),
  ('instructor', 'planning.create'),
  ('instructor', 'planning.own_only'),
  ('instructor', 'sessions.complete');

INSERT IGNORE INTO scheduling_policy (id, credit_policy) VALUES (1, 'credit_on_completion');

INSERT IGNORE INTO vehicle_models (id, label) VALUES
  ('clio-manual', 'Clio manuelle'),
  ('clio-auto', 'Clio automatique'),
  ('rs3', 'Audi RS3 automatique');

INSERT IGNORE INTO tariff_versions (id, model, support, cents, valid_from) VALUES
  ('11111111-1111-4111-8111-111111111101', 'clio-manual', 'Personnel', 2500, '2026-01-01'),
  ('11111111-1111-4111-8111-111111111102', 'clio-manual', 'GoPermis', 3500, '2026-01-01'),
  ('11111111-1111-4111-8111-111111111103', 'clio-auto', 'Personnel', 3000, '2026-01-01'),
  ('11111111-1111-4111-8111-111111111104', 'clio-auto', 'GoPermis', 4500, '2026-01-01'),
  ('11111111-1111-4111-8111-111111111105', 'rs3', 'GoPermis', 7000, '2026-01-01');

INSERT IGNORE INTO service_types (id, label, active, pricing_mode) VALUES
  ('extra', 'Heures complémentaires', 1, 'hourly'),
  ('refresher', 'Remise à niveau', 1, 'hourly'),
  ('exam', 'Examen permis B', 1, 'hourly'),
  ('vtc', 'Examen VTC', 1, 'quote');

INSERT IGNORE INTO offers (id, label, paid_minutes, bonus_minutes, single_payment, active) VALUES
  ('10+1', '10 h + 1 h offerte', 600, 60, 1, 1),
  ('20+2', '20 h + 2 h offertes', 1200, 120, 1, 1);
