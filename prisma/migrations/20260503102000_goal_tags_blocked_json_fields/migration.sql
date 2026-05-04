-- Convert non-encrypted Goal JSON array columns to PostgreSQL jsonb.
CREATE OR REPLACE FUNCTION try_parse_jsonb_array(value text)
RETURNS jsonb AS $$
BEGIN
  IF value IS NULL OR btrim(value) = '' THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN value::jsonb;
EXCEPTION WHEN others THEN
  RETURN '[]'::jsonb;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE "goals"
  ALTER COLUMN "tagsJson" DROP DEFAULT,
  ALTER COLUMN "tagsJson" TYPE jsonb USING try_parse_jsonb_array("tagsJson"),
  ALTER COLUMN "tagsJson" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "blockedByJson" DROP DEFAULT,
  ALTER COLUMN "blockedByJson" TYPE jsonb USING try_parse_jsonb_array("blockedByJson"),
  ALTER COLUMN "blockedByJson" SET DEFAULT '[]'::jsonb;

DROP FUNCTION try_parse_jsonb_array(text);