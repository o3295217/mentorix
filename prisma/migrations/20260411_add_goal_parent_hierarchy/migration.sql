-- AlterTable
ALTER TABLE "goals" ADD COLUMN "parentId" INTEGER;

-- CreateIndex
CREATE INDEX "goals_parentId_idx" ON "goals"("parentId");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
