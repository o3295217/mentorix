-- Rename years to months and convert values (years * 12)
ALTER TABLE "dream_goal" ADD COLUMN "months" INTEGER;
UPDATE "dream_goal" SET "months" = "years" * 12;
ALTER TABLE "dream_goal" ALTER COLUMN "months" SET NOT NULL;
ALTER TABLE "dream_goal" ALTER COLUMN "months" SET DEFAULT 60;
ALTER TABLE "dream_goal" DROP COLUMN "years";
