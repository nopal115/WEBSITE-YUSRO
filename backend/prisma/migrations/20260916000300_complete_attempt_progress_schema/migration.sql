-- Complete the canonical attempt/progress schema without rewriting migrations
-- that have already been deployed.

ALTER TABLE "attempts"
  ADD COLUMN "taskType" "TaskType",
  ADD COLUMN "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "attempts" AS a
SET "taskType" = t."type",
    "submittedAt" = a."createdAt"
FROM "Task" AS t
WHERE t."id" = a."taskId";

-- Preserve legacy history once. The original rows remain read-only until the
-- application cutover is complete; recordingAudioId prevents repeat imports.
WITH legacy_submissions AS (
  SELECT s.*, COALESCE(s."referenceAudioId", t."referenceAudioId") AS "snapshotReferenceAudioId",
    SUM(CASE WHEN s."status" IN ('SUBMITTED', 'PROCESSING') THEN 1 ELSE 0 END)
      OVER (PARTITION BY s."userId", s."taskId" ORDER BY s."submittedAt" DESC, s."id" DESC) AS "activeRank"
  FROM "Submission" AS s
  JOIN "Task" AS t ON t."id" = s."taskId" AND t."type" = 'IMITATION'
  WHERE COALESCE(s."referenceAudioId", t."referenceAudioId") IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "attempts" AS a WHERE a."recordingAudioId" = s."recordingAudioId")
)
INSERT INTO "attempts" (
  "userId", "taskId", "taskType", "attemptNo", "recordingAudioId", "referenceAudioId",
  "evaluationStatus", "score", "feedbackCategory", "processingStartedAt", "evaluatedAt",
  "failedAt", "errorCode", "modelVersion", "submittedAt", "createdAt"
)
SELECT
  s."userId", s."taskId", 'IMITATION'::"TaskType",
  COALESCE(existing."maxAttemptNo", 0) + ROW_NUMBER() OVER (PARTITION BY s."userId", s."taskId" ORDER BY s."submittedAt", s."id"),
  s."recordingAudioId", s."snapshotReferenceAudioId",
  CASE WHEN s."status" IN ('SUBMITTED', 'PROCESSING') AND (s."activeRank" > 1 OR EXISTS (
    SELECT 1 FROM "attempts" AS active WHERE active."userId" = s."userId" AND active."taskId" = s."taskId" AND active."evaluationStatus" IN ('SUBMITTED', 'PROCESSING')
  )) THEN 'FAILED'::"EvaluationStatus" ELSE s."status" END,
  e."score"::DECIMAL(5,2), NULL,
  CASE WHEN s."status" = 'PROCESSING' AND s."activeRank" = 1 THEN s."processedAt" ELSE NULL END,
  CASE WHEN s."status" = 'EVALUATED' THEN e."evaluatedAt" ELSE NULL END,
  CASE WHEN s."status" = 'FAILED' OR s."activeRank" > 1 THEN s."processedAt" ELSE NULL END,
  CASE WHEN s."status" = 'FAILED' OR s."activeRank" > 1 THEN 'LEGACY_EVALUATION_FAILED' ELSE NULL END,
  e."modelVersion", s."submittedAt", s."submittedAt"
FROM legacy_submissions AS s
LEFT JOIN "Evaluation" AS e ON e."submissionId" = s."id"
LEFT JOIN LATERAL (
  SELECT MAX(a."attemptNo") AS "maxAttemptNo"
  FROM "attempts" AS a
  WHERE a."userId" = s."userId" AND a."taskId" = s."taskId"
) AS existing ON true;

INSERT INTO "attempts" (
  "userId", "taskId", "taskType", "attemptNo", "score", "correctCount", "questionCount", "evaluatedAt", "submittedAt", "createdAt"
)
SELECT
  q."userId", q."taskId", 'QUIZ'::"TaskType",
  COALESCE(existing."maxAttemptNo", 0) + ROW_NUMBER() OVER (PARTITION BY q."userId", q."taskId" ORDER BY q."completedAt", q."id"),
  q."score"::DECIMAL(5,2),
  ROUND((q."score" / 100.0) * question_counts."count")::INTEGER, question_counts."count", q."completedAt", q."completedAt", q."completedAt"
FROM "QuizAttempt" AS q
JOIN "Task" AS t ON t."id" = q."taskId" AND t."type" = 'QUIZ'
JOIN LATERAL (SELECT COUNT(*)::INTEGER AS "count" FROM "Question" WHERE "taskId" = q."taskId") AS question_counts ON true
LEFT JOIN LATERAL (
  SELECT MAX(a."attemptNo") AS "maxAttemptNo"
  FROM "attempts" AS a
  WHERE a."userId" = q."userId" AND a."taskId" = q."taskId"
) AS existing ON true;

ALTER TABLE "attempts"
  ALTER COLUMN "taskType" SET NOT NULL,
  ADD CONSTRAINT "attempts_task_shape_check" CHECK (
    (
      "taskType" = 'QUIZ'
      AND "recordingAudioId" IS NULL AND "referenceAudioId" IS NULL
      AND "evaluationStatus" IS NULL AND "processingStartedAt" IS NULL
      AND "evaluatedAt" IS NOT NULL AND "failedAt" IS NULL
      AND "errorCode" IS NULL AND "modelVersion" IS NULL AND "processingMs" IS NULL
      AND "correctCount" IS NOT NULL AND "questionCount" IS NOT NULL
    ) OR (
      "taskType" = 'IMITATION'
      AND "recordingAudioId" IS NOT NULL AND "referenceAudioId" IS NOT NULL
      AND "evaluationStatus" IS NOT NULL
      AND "correctCount" IS NULL AND "questionCount" IS NULL
    )
  ),
  ADD CONSTRAINT "attempts_quiz_answer_count_check" CHECK (
    "taskType" <> 'QUIZ' OR ("correctCount" >= 0 AND "questionCount" > 0 AND "correctCount" <= "questionCount")
  );

ALTER TABLE "TaskProgress"
  ADD COLUMN "firstAttemptAt" TIMESTAMP(3),
  ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bestScore" DECIMAL(5,2);

UPDATE "TaskProgress" AS tp
SET "firstAttemptAt" = summary."firstAttemptAt",
    "lastAttemptAt" = summary."lastAttemptAt",
    "attemptCount" = summary."attemptCount",
    "bestScore" = summary."bestScore"
FROM (
  SELECT "userId", "taskId", MIN("submittedAt") AS "firstAttemptAt", MAX("submittedAt") AS "lastAttemptAt",
         COUNT(*)::INTEGER AS "attemptCount", MAX("score") AS "bestScore"
  FROM "attempts"
  GROUP BY "userId", "taskId"
) AS summary
WHERE summary."userId" = tp."userId" AND summary."taskId" = tp."taskId";

CREATE INDEX "attempts_user_submitted_idx" ON "attempts"("userId", "submittedAt");
CREATE INDEX "attempts_task_evaluation_submitted_idx" ON "attempts"("taskId", "evaluationStatus", "submittedAt");
CREATE INDEX "attempts_type_evaluation_submitted_idx" ON "attempts"("taskType", "evaluationStatus", "submittedAt");
CREATE INDEX "TaskProgress_user_completed_idx" ON "TaskProgress"("userId", "completedAt");
CREATE INDEX "TaskProgress_task_best_score_idx" ON "TaskProgress"("taskId", "bestScore");

CREATE OR REPLACE VIEW "progress_summary" AS
SELECT
  u."id" AS "userId",
  COUNT(DISTINCT mp."materialId") FILTER (WHERE mp."completedAt" IS NOT NULL)::INTEGER AS "materialsCompleted",
  COUNT(DISTINCT tp."taskId") FILTER (WHERE tp."completedAt" IS NOT NULL)::INTEGER AS "tasksCompleted",
  COALESCE(SUM(tp."attemptCount"), 0)::INTEGER AS "attemptCount",
  MAX(tp."bestScore") AS "bestScore",
  MAX(tp."lastAttemptAt") AS "lastAttemptAt"
FROM "User" AS u
LEFT JOIN "MaterialProgress" AS mp ON mp."userId" = u."id"
LEFT JOIN "TaskProgress" AS tp ON tp."userId" = u."id"
GROUP BY u."id";
