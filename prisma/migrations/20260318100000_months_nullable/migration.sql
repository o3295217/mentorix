-- AlterTable: make months nullable, remove default
ALTER TABLE "dream_goal" ALTER COLUMN "months" DROP NOT NULL;
ALTER TABLE "dream_goal" ALTER COLUMN "months" DROP DEFAULT;
