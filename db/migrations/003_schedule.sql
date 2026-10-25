CREATE EXTENSION IF NOT EXISTS btree_gist;
INSERT INTO permission VALUES ('schedule.read'),('schedule.write'),('sessions.complete'),('resources.write');
-- No change to the unapproved organisational roles, including instructor.
INSERT INTO role_permission SELECT 'technical_admin',id FROM permission WHERE id IN ('schedule.read','schedule.write','sessions.complete','resources.write');
CREATE TABLE scheduling_policy (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 credit_policy text CHECK(credit_policy IN ('reserve_credit','credit_on_completion'))
);
-- GoPermis decision, 2026-10-25: planning without credit, completion requires credit.
INSERT INTO scheduling_policy(id,credit_policy) VALUES(true,'credit_on_completion');
CREATE TABLE vehicle (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), model_id text NOT NULL REFERENCES vehicle_model,
 label text NOT NULL UNIQUE, active boolean NOT NULL DEFAULT true,
 created_by uuid NOT NULL REFERENCES app_user, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE instructor (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
 active boolean NOT NULL DEFAULT true, created_by uuid NOT NULL REFERENCES app_user,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE booking (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), service_id uuid NOT NULL REFERENCES service,
 client_id uuid NOT NULL REFERENCES client, vehicle_id uuid NOT NULL REFERENCES vehicle,
 instructor_id uuid REFERENCES instructor, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 minutes integer NOT NULL CHECK(minutes>0), status text NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','completed')),
 companion_name text, companion_license_date date,
 request_id uuid NOT NULL UNIQUE, created_by uuid NOT NULL REFERENCES app_user,
 created_at timestamptz NOT NULL DEFAULT now(), completed_by uuid REFERENCES app_user, completed_at timestamptz,
 CHECK(ends_at>starts_at AND extract(epoch FROM ends_at-starts_at)=minutes*60),
 CHECK((status='completed')=(completed_at IS NOT NULL AND completed_by IS NOT NULL))
);
CREATE INDEX booking_service ON booking(service_id,status);
CREATE INDEX booking_client ON booking(client_id,starts_at);
CREATE TABLE unavailability (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reason text NOT NULL,
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, CHECK(ends_at>starts_at),
 created_by uuid NOT NULL REFERENCES app_user, created_at timestamptz NOT NULL DEFAULT now(),
 released_at timestamptz, released_by uuid REFERENCES app_user
);
-- Both confirmed sessions and explicit unavailability use the same exclusion space.
-- Half-open ranges permit adjacent sessions. Constraints protect concurrent writers.
CREATE TABLE calendar_occupancy (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 booking_id uuid REFERENCES booking, unavailability_id uuid REFERENCES unavailability,
 vehicle_id uuid REFERENCES vehicle, instructor_id uuid REFERENCES instructor, client_id uuid REFERENCES client,
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 CHECK(ends_at>starts_at), CHECK(num_nonnulls(booking_id,unavailability_id)=1),
 CHECK(num_nonnulls(vehicle_id,instructor_id,client_id)=1),
 CONSTRAINT vehicle_busy EXCLUDE USING gist(vehicle_id WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE(vehicle_id IS NOT NULL),
 CONSTRAINT instructor_busy EXCLUDE USING gist(instructor_id WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE(instructor_id IS NOT NULL),
 CONSTRAINT client_busy EXCLUDE USING gist(client_id WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE(client_id IS NOT NULL)
);
ALTER TABLE hour_ledger ADD COLUMN booking_id uuid UNIQUE REFERENCES booking;
ALTER TABLE hour_ledger ADD CONSTRAINT session_reference CHECK((kind='session')=(booking_id IS NOT NULL));
ALTER TABLE hour_ledger ADD CONSTRAINT session_debit CHECK(kind<>'session' OR minutes<0);
CREATE FUNCTION protect_booking_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Booking history cannot be deleted'; END IF;
 IF OLD.status<>'confirmed' OR NEW.status<>'completed' OR
 (to_jsonb(NEW)-ARRAY['status','completed_by','completed_at']) IS DISTINCT FROM
 (to_jsonb(OLD)-ARRAY['status','completed_by','completed_at']) THEN
 RAISE EXCEPTION 'Only completion is allowed';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER booking_history BEFORE UPDATE OR DELETE ON booking FOR EACH ROW EXECUTE FUNCTION protect_booking_history();
