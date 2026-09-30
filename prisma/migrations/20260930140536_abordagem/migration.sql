-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "contactedAt" DATETIME;

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);
