-- History is append-only for application use. Corrections must be new entries.
CREATE FUNCTION reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Append-only history: create a correcting entry instead'; END;
$$;
CREATE TRIGGER hour_ledger_immutable BEFORE UPDATE OR DELETE ON hour_ledger FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER audit_event_immutable BEFORE UPDATE OR DELETE ON audit_event FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER payment_immutable BEFORE UPDATE OR DELETE ON payment FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE FUNCTION protect_price_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.price_snapshot IS DISTINCT FROM OLD.price_snapshot THEN
  RAISE EXCEPTION 'Accepted price snapshot is immutable';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER price_snapshot_immutable BEFORE UPDATE ON service FOR EACH ROW EXECUTE FUNCTION protect_price_snapshot();
