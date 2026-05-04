-- Convert WorkSummary.keyAchievements to jsonb while preserving encrypted legacy strings.
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

ALTER TABLE "work_summaries"
  ALTER COLUMN "keyAchievements" DROP DEFAULT,
  ALTER COLUMN "keyAchievements" TYPE jsonb USING try_parse_or_preserve_encrypted_jsonb("keyAchievements", '[]'::jsonb),
  ALTER COLUMN "keyAchievements" SET DEFAULT '[]'::jsonb;

DROP FUNCTION try_parse_or_preserve_encrypted_jsonb(text, jsonb);