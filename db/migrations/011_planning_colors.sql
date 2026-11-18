-- Couleurs du planning : une par moniteur, plus accompagnateur personnel et examen.
ALTER TABLE instructor ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE scheduling_policy ADD COLUMN IF NOT EXISTS companion_color text;
ALTER TABLE scheduling_policy ADD COLUMN IF NOT EXISTS exam_color text;
