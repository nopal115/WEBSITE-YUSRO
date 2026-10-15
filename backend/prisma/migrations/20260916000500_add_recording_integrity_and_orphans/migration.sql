ALTER TABLE "AudioAsset" ADD COLUMN "checksumSha256" TEXT;
CREATE INDEX "AudioAsset_checksumSha256_idx" ON "AudioAsset"("checksumSha256");

CREATE TABLE "storage_orphans" (
  "id" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "cleanupReason" TEXT NOT NULL,
  "lastErrorDetail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cleanedAt" TIMESTAMP(3),
  CONSTRAINT "storage_orphans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "storage_orphans_objectKey_key" UNIQUE ("objectKey")
);
CREATE INDEX "storage_orphans_cleanedAt_createdAt_idx" ON "storage_orphans"("cleanedAt", "createdAt");
