-- Apply only after 20260916000300_complete_attempt_progress_schema.  The
-- prior migration backfills legacy rows first; this migration hardens the
-- canonical schema only after those rows have a valid canonical shape.

-- Quiz history predates FeedbackCategory. Populate it once before requiring
-- the canonical Quiz shape.
UPDATE "attempts"
SET "feedbackCategory" = CASE
  WHEN "score" >= 90 THEN 'SANGAT_BAIK'::"FeedbackCategory"
  WHEN "score" >= 80 THEN 'BAIK'::"FeedbackCategory"
  WHEN "score" >= 70 THEN 'CUKUP'::"FeedbackCategory"
  ELSE 'PERLU_LATIHAN'::"FeedbackCategory"
END
WHERE "taskType" = 'QUIZ'
  AND "feedbackCategory" IS NULL
  AND "score" IS NOT NULL;

ALTER TABLE "attempts"
  ADD CONSTRAINT "chk_attempts_score_range"
    CHECK ("score" IS NULL OR "score" BETWEEN 0 AND 100),
  ADD CONSTRAINT "chk_attempts_quiz_has_score_and_feedback"
    CHECK (
      "taskType" <> 'QUIZ'
      OR ("score" IS NOT NULL AND "feedbackCategory" IS NOT NULL)
    );

-- This partial index is deliberately SQL-only: Prisma cannot express a
-- partial index, but statistics must skip SUBMITTED/PROCESSING/FAILED rows.
CREATE INDEX "attempts_valid_score_statistics_idx"
  ON "attempts"("taskId", "score", "submittedAt")
  WHERE "score" IS NOT NULL;

-- Keep the derived summary free from the Cartesian-product multiplication
-- caused by joining MaterialProgress and TaskProgress in one aggregate.
CREATE OR REPLACE VIEW "progress_summary" AS
SELECT
  u."id" AS "userId",
  (
    SELECT COUNT(*)::INTEGER
    FROM "MaterialProgress" AS mp
    WHERE mp."userId" = u."id" AND mp."completedAt" IS NOT NULL
  ) AS "materialsCompleted",
  (
    SELECT COUNT(*)::INTEGER
    FROM "TaskProgress" AS tp
    WHERE tp."userId" = u."id" AND tp."completedAt" IS NOT NULL
  ) AS "tasksCompleted",
  COALESCE((
    SELECT SUM(tp."attemptCount")::INTEGER
    FROM "TaskProgress" AS tp
    WHERE tp."userId" = u."id"
  ), 0) AS "attemptCount",
  (
    SELECT MAX(tp."bestScore")
    FROM "TaskProgress" AS tp
    WHERE tp."userId" = u."id"
  ) AS "bestScore",
  (
    SELECT MAX(tp."lastAttemptAt")
    FROM "TaskProgress" AS tp
    WHERE tp."userId" = u."id"
  ) AS "lastAttemptAt"
FROM "User" AS u;
