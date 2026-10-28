INSERT INTO permission VALUES('catalog.write') ON CONFLICT DO NOTHING;
INSERT INTO role_permission VALUES('technical_admin','catalog.write') ON CONFLICT DO NOTHING;
