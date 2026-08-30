-- CreateTable
CREATE TABLE "FbSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "adAccountId" TEXT,
    "accessTokenEnc" TEXT,
    "apiVersion" TEXT NOT NULL DEFAULT 'v21.0',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FbSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdInsight" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "level" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityName" TEXT,
    "spendUsd" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "fbLeads" INTEGER NOT NULL DEFAULT 0,
    "usdToUzs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FxRate" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "usdToUzs" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'cbu',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdInsight_date_idx" ON "AdInsight"("date");

-- CreateIndex
CREATE INDEX "AdInsight_level_idx" ON "AdInsight"("level");

-- CreateIndex
CREATE INDEX "AdInsight_entityId_idx" ON "AdInsight"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "AdInsight_date_level_entityId_key" ON "AdInsight"("date", "level", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "FxRate_date_key" ON "FxRate"("date");
