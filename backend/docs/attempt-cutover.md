# Attempt cutover

Migration `20260916000300_complete_attempt_progress_schema` backfills legacy
`Submission`/`Evaluation` and `QuizAttempt` history into `attempts` once. It
does not delete legacy rows, so rollback remains possible by switching reads
back to the old tables.

The remaining cutover sequence is intentionally explicit:

1. Move every write and read endpoint to `Attempt` and `TaskProgress`.
2. Reconcile per-user/task attempt counts and best scores against the legacy
   tables in production.
3. Run one release with legacy tables read-only and monitor the queue/view.
4. Archive legacy tables in a separately approved destructive migration; do
   not drop them in the schema migration above.
