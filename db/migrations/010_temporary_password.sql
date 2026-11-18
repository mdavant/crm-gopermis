-- Comptes : permissions individuelles, profil, mot de passe temporaire à changer à la 1re connexion.
CREATE TABLE IF NOT EXISTS user_permission (
  user_id uuid REFERENCES app_user(id) ON DELETE CASCADE,
  permission_id text NOT NULL,
  PRIMARY KEY (user_id, permission_id)
);
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS role_preset text DEFAULT 'custom';
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS temp_password text;
INSERT INTO user_permission (user_id, permission_id)
  SELECT ur.user_id, 'admin.full' FROM user_role ur WHERE ur.role_id = 'technical_admin'
  ON CONFLICT DO NOTHING;
