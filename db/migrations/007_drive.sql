-- Drive and Document Management
CREATE TABLE IF NOT EXISTS drive_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES drive_item(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL, -- 'folder' or 'file'
  mime_type text,
  size bigint DEFAULT 0,
  data text, -- base64 data URL or text content
  starred boolean DEFAULT false,
  color text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES app_user(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_drive_item_parent ON drive_item(parent_id);
CREATE INDEX IF NOT EXISTS idx_drive_item_type ON drive_item(type);
CREATE INDEX IF NOT EXISTS idx_drive_item_name ON drive_item(name);
