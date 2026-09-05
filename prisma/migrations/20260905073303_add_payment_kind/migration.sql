-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('PARTIAL', 'FULL');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "kind" "PaymentKind" NOT NULL DEFAULT 'FULL';
