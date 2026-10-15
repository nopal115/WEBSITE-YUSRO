-- Align the development schema with the final SDD vocabulary.
ALTER TYPE "UserRole" RENAME VALUE 'ADMIN_PENGAJAR' TO 'ADMIN';
ALTER TYPE "AudioType" RENAME VALUE 'ML_DATASET' TO 'DATASET';
ALTER TYPE "TaskType" RENAME VALUE 'LISTEN_SELECT' TO 'QUIZ';
ALTER TYPE "TaskType" RENAME VALUE 'LISTEN_REPEAT' TO 'IMITATION';

CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');
CREATE TYPE "FeedbackCategory" AS ENUM ('SANGAT_BAIK', 'BAIK', 'CUKUP', 'PERLU_LATIHAN');

ALTER TABLE "AudioAsset" ADD COLUMN "durationMs" INTEGER;

CREATE TABLE "attempts" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "taskId" TEXT NOT NULL,
  "attemptNo" INTEGER NOT NULL, "recordingAudioId" TEXT, "referenceAudioId" TEXT,
  "evaluationStatus" "EvaluationStatus", "score" DECIMAL(5,2),
  "feedbackCategory" "FeedbackCategory", "correctCount" INTEGER, "questionCount" INTEGER,
  "processingStartedAt" TIMESTAMP(3), "evaluatedAt" TIMESTAMP(3), "failedAt" TIMESTAMP(3),
  "errorCode" TEXT, "modelVersion" TEXT, "processingMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT,
  CONSTRAINT "attempts_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT,
  CONSTRAINT "attempts_recordingAudioId_fkey" FOREIGN KEY ("recordingAudioId") REFERENCES "AudioAsset"("id") ON DELETE RESTRICT,
  CONSTRAINT "attempts_referenceAudioId_fkey" FOREIGN KEY ("referenceAudioId") REFERENCES "AudioAsset"("id") ON DELETE RESTRICT,
  CONSTRAINT "chk_attempts_failed_has_no_score" CHECK ("evaluationStatus" <> 'FAILED' OR "score" IS NULL),
  CONSTRAINT "chk_attempts_evaluated_has_score" CHECK ("evaluationStatus" <> 'EVALUATED' OR "score" IS NOT NULL)
);
CREATE UNIQUE INDEX "attempts_user_task_number" ON "attempts"("userId", "taskId", "attemptNo");
CREATE INDEX "attempts_user_task_status" ON "attempts"("userId", "taskId", "evaluationStatus");
CREATE UNIQUE INDEX "uq_attempts_one_active" ON "attempts"("userId", "taskId") WHERE "evaluationStatus" IN ('SUBMITTED', 'PROCESSING');

CREATE TABLE "evaluation_jobs" (
  "id" TEXT NOT NULL, "attemptId" TEXT NOT NULL, "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
  "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "runCount" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3), "finishedAt" TIMESTAMP(3), "lastErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evaluation_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "evaluation_jobs_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "attempts"("id") ON DELETE RESTRICT
);
CREATE INDEX "evaluation_jobs_queue" ON "evaluation_jobs"("status", "runAfter", "createdAt");

CREATE TABLE "refresh_tokens" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "familyId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"), CONSTRAINT "refresh_tokens_tokenHash_key" UNIQUE ("tokenHash"),
  CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT
);
CREATE INDEX "refresh_tokens_user_family" ON "refresh_tokens"("userId", "familyId");

CREATE TABLE "password_reset_tokens" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id"), CONSTRAINT "password_reset_tokens_tokenHash_key" UNIQUE ("tokenHash"),
  CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT
);
CREATE TABLE "audit_logs" ("id" TEXT NOT NULL, "actorId" TEXT, "action" TEXT NOT NULL, "entityType" TEXT NOT NULL, "entityId" TEXT, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"));

ALTER TABLE "AudioAsset" ADD CONSTRAINT "chk_recording_duration" CHECK ("type" <> 'RECORDING' OR "durationMs" BETWEEN 2000 AND 60000);
ALTER TABLE "AudioAsset" ADD CONSTRAINT "chk_recording_size" CHECK ("type" <> 'RECORDING' OR "sizeBytes" <= 10485760);
