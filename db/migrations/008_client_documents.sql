-- Parité PostgreSQL / PGlite pour les dossiers clients et documents sécurisés
CREATE TABLE IF NOT EXISTS client_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES client(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES client_folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES app_user(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pg_client_folders_client ON client_folders(client_id);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES client(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES client_folders(id) ON DELETE SET NULL,
  uploaded_by uuid NOT NULL REFERENCES app_user(id),
  original_name text NOT NULL,
  stored_name text NOT NULL UNIQUE,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint NOT NULL,
  is_private boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pg_documents_client ON documents(client_id);
CREATE INDEX IF NOT EXISTS idx_pg_documents_folder ON documents(folder_id);

INSERT INTO permission VALUES ('documents.read'),('documents.write') ON CONFLICT DO NOTHING;
INSERT INTO role_permission VALUES ('technical_admin','documents.read'),('technical_admin','documents.write'),('manager','documents.read'),('manager','documents.write'),('administration','documents.read'),('administration','documents.write') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS user_permission (
  user_id uuid REFERENCES app_user(id) ON DELETE CASCADE,
  permission_id text NOT NULL,
  PRIMARY KEY(user_id, permission_id)
);

