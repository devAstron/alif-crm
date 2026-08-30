-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "processingStatus" TEXT,
ADD COLUMN     "qualifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Lead_qualifiedAt_idx" ON "Lead"("qualifiedAt");
