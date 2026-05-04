-- Convert WorkSummary.topCategoriesJson from serialized text to PostgreSQL jsonb.
CREATE OR REPLACE FUNCTION try_parse_jsonb_nullable(value text)
RETURNS jsonb AS $$
BEGIN
  IF value IS NULL OR btrim(value) = '' THEN
    RETURN NULL;
  END IF;

  RETURN value::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE "work_summaries"
  ALTER COLUMN "topCategoriesJson" TYPE jsonb USING try_parse_jsonb_nullable("topCategoriesJson");

DROP FUNCTION try_parse_jsonb_nullable(text);