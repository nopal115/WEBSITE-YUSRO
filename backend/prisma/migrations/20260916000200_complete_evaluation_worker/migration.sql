ALTER TABLE "evaluation_jobs"
  ADD COLUMN "maxRuns" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "lockedBy" TEXT,
  ADD COLUMN "lastErrorDetail" TEXT,
  ADD COLUMN "isRetry" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requestedById" TEXT;

ALTER TABLE "evaluation_jobs"
  ADD CONSTRAINT "evaluation_jobs_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "evaluation_jobs_running_lock_idx"
  ON "evaluation_jobs"("status", "lockedAt") WHERE "status" = 'RUNNING';
