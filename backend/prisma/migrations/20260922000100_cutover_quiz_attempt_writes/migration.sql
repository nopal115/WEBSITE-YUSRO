-- Canonicalize new Quiz writes. Legacy QuizAttempt/QuizAnswer rows remain
-- untouched for rollback, while their answers are copied into AttemptAnswer.

CREATE TABLE "attempt_answers" (
  "id" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "optionId" TEXT NOT NULL,
  CONSTRAINT "attempt_answers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attempt_answers_attemptId_questionId_key" UNIQUE ("attemptId", "questionId"),
  CONSTRAINT "attempt_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "attempt_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "attempt_answers_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "AnswerOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "attempt_answers_questionId_idx" ON "attempt_answers"("questionId");
CREATE INDEX "attempt_answers_optionId_idx" ON "attempt_answers"("optionId");

-- The prior backfill creates canonical quiz attempts in the same stable
-- (user, task, completion time, id) order as their legacy source rows.
-- Pairing row numbers makes this backfill repeatable without modifying legacy
-- records. Rows already copied are ignored through the unique constraint.
WITH legacy_ranked AS (
  SELECT qa."id", qa."questionId", qa."optionId", q."userId", q."taskId",
    ROW_NUMBER() OVER (PARTITION BY q."userId", q."taskId" ORDER BY q."completedAt", q."id") AS rn
  FROM "QuizAnswer" qa
  JOIN "QuizAttempt" q ON q."id" = qa."attemptId"
), canonical_ranked AS (
  SELECT a."id", a."userId", a."taskId",
    ROW_NUMBER() OVER (PARTITION BY a."userId", a."taskId" ORDER BY a."submittedAt", a."id") AS rn
  FROM "attempts" a
  WHERE a."taskType" = 'QUIZ'
)
INSERT INTO "attempt_answers" ("id", "attemptId", "questionId", "optionId")
SELECT l."id", c."id", l."questionId", l."optionId"
FROM legacy_ranked l
JOIN canonical_ranked c ON c."userId" = l."userId" AND c."taskId" = l."taskId" AND c.rn = l.rn
ON CONFLICT ("attemptId", "questionId") DO NOTHING;
