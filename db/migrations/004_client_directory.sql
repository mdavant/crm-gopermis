CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE FUNCTION crm_normalize(value text) RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
 SELECT regexp_replace(translate(lower(value),'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ','aaaaaaceeeeiiiinooooouuuuyy'),'[^a-z0-9@]','','g');
$$;
CREATE FUNCTION crm_phone_key(value text) RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
 SELECT CASE WHEN length(d)=13 AND d LIKE '0033%' THEN '0'||right(d,9) WHEN length(d)=11 AND d LIKE '33%' THEN '0'||right(d,9) ELSE d END FROM (SELECT regexp_replace(value,'[^0-9]','','g') AS d) p;
$$;
ALTER TABLE client ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE client ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE client ADD COLUMN search_key text GENERATED ALWAYS AS (
 crm_normalize(first_name||' '||last_name||' '||phone||' '||crm_phone_key(phone)||' '||COALESCE(email,'')||' '||id::text)
) STORED;
CREATE INDEX client_search_trgm ON client USING gin(search_key gin_trgm_ops);
CREATE INDEX client_directory_order ON client(created_at DESC,id DESC);
CREATE INDEX client_phone_key ON client(crm_phone_key(phone));
CREATE INDEX client_email_key ON client(lower(email)) WHERE email IS NOT NULL;
