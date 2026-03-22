-- CreateTable
CREATE TABLE "planning_profiles" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "hoursPerWeek" INTEGER,
    "experienceLevel" TEXT,
    "hasBudget" TEXT,
    "currentWorkload" TEXT,
    "constraints" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planning_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "planning_profiles_userId_key" ON "planning_profiles"("userId");

-- AddForeignKey
ALTER TABLE "planning_profiles" ADD CONSTRAINT "planning_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
