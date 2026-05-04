-- Convert selected UserStats JSON string columns to PostgreSQL jsonb.
-- Invalid legacy payloads fall back to the same defaults the application already used.
CREATE OR REPLACE FUNCTION try_parse_jsonb(value text, fallback jsonb)
RETURNS jsonb AS $$
BEGIN
  IF value IS NULL OR btrim(value) = '' THEN
    RETURN fallback;
  END IF;

  RETURN value::jsonb;
EXCEPTION WHEN others THEN
  RETURN fallback;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE "user_stats"
  ALTER COLUMN "completionByDayJson" DROP DEFAULT,
  ALTER COLUMN "completionByDayJson" TYPE jsonb USING try_parse_jsonb("completionByDayJson", '{}'::jsonb),
  ALTER COLUMN "completionByDayJson" SET DEFAULT '{}'::jsonb,
  ALTER COLUMN "completionByTypeJson" DROP DEFAULT,
  ALTER COLUMN "completionByTypeJson" TYPE jsonb USING try_parse_jsonb("completionByTypeJson", '{}'::jsonb),
  ALTER COLUMN "completionByTypeJson" SET DEFAULT '{}'::jsonb,
  ALTER COLUMN "frequentCompletedJson" DROP DEFAULT,
  ALTER COLUMN "frequentCompletedJson" TYPE jsonb USING try_parse_jsonb("frequentCompletedJson", '[]'::jsonb),
  ALTER COLUMN "frequentCompletedJson" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "frequentFailedJson" DROP DEFAULT,
  ALTER COLUMN "frequentFailedJson" TYPE jsonb USING try_parse_jsonb("frequentFailedJson", '[]'::jsonb),
  ALTER COLUMN "frequentFailedJson" SET DEFAULT '[]'::jsonb;

DROP FUNCTION try_parse_jsonb(text, jsonb);