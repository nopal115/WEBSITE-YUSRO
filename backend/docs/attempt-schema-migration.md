# Attempt schema: inventory, ownership, and rollout

This document governs the compatible migration from legacy `Submission`,
`Evaluation`, and `QuizAttempt` history to canonical `attempts`.

## Inventory before production migration

Run these read-only checks against the production database and attach their
output to the deployment record. Do not run the constraint migration until
each result has been reviewed.

```sql
-- Legacy rows that cannot become an Imitation attempt without manual repair.
SELECT s."id", s."userId", s."taskId"
FROM "Submission" AS s
LEFT JOIN "Task" AS t ON t."id" = s."taskId"
WHERE t."type" <> 'IMITATION'
   OR COALESCE(s."referenceAudioId", t."referenceAudioId") IS NULL;

-- Legacy evaluated rows without a valid score.
SELECT s."id", e."score"
FROM "Submission" AS s
LEFT JOIN "Evaluation" AS e ON e."submissionId" = s."id"
WHERE s."status" = 'EVALUATED'
  AND (e."score" IS NULL OR e."score" < 0 OR e."score" > 100);

-- More than one active legacy evaluation for a user/task.
SELECT "userId", "taskId", COUNT(*)
FROM "Submission"
WHERE "status" IN ('SUBMITTED', 'PROCESSING')
GROUP BY "userId", "taskId"
HAVING COUNT(*) > 1;

-- Invalid legacy quiz scores.
SELECT "id", "userId", "taskId", "score"
FROM "QuizAttempt"
WHERE "score" < 0 OR "score" > 100;
```

## Safe rollout sequence

1. Apply additive migration `20260916000100_add_sdd_core`.
2. Apply worker/progress compatibility migrations `...200` and `...300`.
   Migration `...300` backfills legacy attempts while legacy tables remain
   read-only to the new application paths.
3. Reconcile attempt count, latest attempt, and best valid score per user/task
   against legacy history.
4. Apply `20260916000400_harden_attempt_constraints`; it fills the derived
   quiz feedback category, enforces score range, and fixes the summary view.
5. Deploy readers/writers that use `Attempt` and `TaskProgress`, monitor one
   release, then archive legacy tables only in a separately approved migration.

No migration in this sequence deletes legacy data.

## Ownership of canonical fields

| Owner | Writes |
| --- | --- |
| Imitation | Initial Imitation attempt, recording/reference snapshot, `SUBMITTED`, initial job |
| Evaluation | Evaluation status transitions, score, feedback category, model/version/timing/error fields, evaluation jobs |
| Quiz | Quiz attempt score, feedback category, correct/question counts |
| Progress | `TaskProgress` and derived `progress_summary` reconciliation |

`EvaluationJob` has a many-to-one relation to `Attempt`: the initial job and
every admin retry may reference the same attempt. There is intentionally no
unique constraint on `evaluation_jobs.attemptId`.

## Locks and constraints

The submit transaction holds PostgreSQL transaction advisory lock
`(hashtext(userId), hashtext(taskId))`. The database additionally enforces
`uq_attempts_one_active`, a partial unique index for `SUBMITTED`/`PROCESSING`.
The lock provides a predictable cooldown/attempt-number decision; the partial
unique index remains the final race-condition guard.
