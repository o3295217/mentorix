-- Convert encrypted DailyEntry JSON fields to jsonb while preserving encrypted legacy strings.
CREATE OR REPLACE FUNCTION try_parse_or_preserve_encrypted_jsonb(value text, fallback jsonb)
RETURNS jsonb AS $$
BEGIN
  IF value IS NULL OR btrim(value) = '' THEN
    RETURN fallback;
  END IF;

  IF starts_with(value, 'enc_v1:') THEN
    RETURN to_jsonb(value);
  END IF;

  RETURN value::jsonb;
EXCEPTION WHEN others THEN
  RETURN fallback;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE "daily_entries"
  ALTER COLUMN "planSnapshotJson" TYPE jsonb USING try_parse_or_preserve_encrypted_jsonb("planSnapshotJson", NULL::jsonb),
  ALTER COLUMN "extraTasksJson" DROP DEFAULT,
  ALTER COLUMN "extraTasksJson" TYPE jsonb USING try_parse_or_preserve_encrypted_jsonb("extraTasksJson", '[]'::jsonb),
  ALTER COLUMN "extraTasksJson" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "selectedTasksJson" TYPE jsonb USING try_parse_or_preserve_encrypted_jsonb("selectedTasksJson", NULL::jsonb);

DROP FUNCTION try_parse_or_preserve_encrypted_jsonb(text, jsonb);