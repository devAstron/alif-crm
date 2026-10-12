-- AlterTable
ALTER TABLE "CapiEvent" ADD COLUMN     "paymentId" TEXT;

-- CreateIndex
CREATE INDEX "CapiEvent_paymentId_idx" ON "CapiEvent"("paymentId");
