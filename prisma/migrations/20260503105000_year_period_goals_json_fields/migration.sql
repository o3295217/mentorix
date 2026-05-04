-- Convert encrypted YearGoal/PeriodGoal.goalsJson to jsonb while preserving encrypted legacy strings.
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

ALTER TABLE "year_goals"
  ALTER COLUMN "goalsJson" TYPE jsonb USING try_parse_or_preserve_encrypted_jsonb("goalsJson", '[]'::jsonb);

ALTER TABLE "period_goals"
  ALTER COLUMN "goalsJson" TYPE jsonb USING try_parse_or_preserve_encrypted_jsonb("goalsJson", '[]'::jsonb);

DROP FUNCTION try_parse_or_preserve_encrypted_jsonb(text, jsonb);