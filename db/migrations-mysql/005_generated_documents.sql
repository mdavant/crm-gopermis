-- Migration 005 : documents générés depuis la fiche élève (fiche de location,
-- attestation d'assurance) et leurs paramètres, pour l'historique.
CREATE TABLE IF NOT EXISTS generated_documents (
  id CHAR(36) NOT NULL PRIMARY KEY,
  client_id CHAR(36) NOT NULL,
  kind ENUM('rental', 'insurance') NOT NULL,
  vehicle_id CHAR(36) NULL,
  booking_id CHAR(36) NULL,
  document_id CHAR(36) NULL,
  signature_date DATE NOT NULL,
  period_start DATETIME NULL,
  period_end DATETIME NULL,
  total_cents INT NULL,
  params LONGTEXT NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_generated_documents_client (client_id, created_at),
  CONSTRAINT fk_generated_documents_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_generated_documents_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
  CONSTRAINT fk_generated_documents_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
