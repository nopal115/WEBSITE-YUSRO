// Endpoint Admin SDD 5.18 yang ditiru di A1: ringkasan dashboard dan daftar "perlu diperhatikan".
// Endpoint admin lain belum ditiru (dijawab 404).
import { SAMPLE_EVALUATION, SAMPLE_STUDENTS } from '../data/students';
import { accessFor, db, progressSnapshot, quizAttemptsOf, submissionsOf, submissionStatus, validResults } from '../db';
import { ok } from '../http';
import type { MockRoute } from '../router';
import { attentionOf, round2, type StudentActivity } from '../rules';
import { CONTENT } from '../data/content';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Aktivitas akun Santri demo dihitung dari data mock yang sedang berjalan. */
function liveActivity(userId: string): StudentActivity {
  const { materialStatus } = accessFor(userId);
  const availableTasks = CONTENT.tasks.filter((task) => materialStatus.get(task.materialId) !== 'LOCKED').length;
  const bests = new Map<string, { taskId: string; bestScore: number; lastAttemptAt: string }>();
  for (const result of validResults(userId)) {
    const current = bests.get(result.taskId);
    bests.set(result.taskId, {
      taskId: result.taskId,
      bestScore: Math.max(current?.bestScore ?? 0, result.score),
      lastAttemptAt: current && current.lastAttemptAt > result.submittedAt ? current.lastAttemptAt : result.submittedAt,
    });
  }
  return {
    learningProgressPct: progressSnapshot(userId).learningProgressPct,
    availableTasks,
    attemptCount: quizAttemptsOf(userId).length + submissionsOf(userId).length,
    taskBests: [...bests.values()],
  };
}

/** Seluruh Santri: [DATA CONTOH] ditambah akun Santri demo. */
function allStudents() {
  const live = db.users
    .filter((user) => user.role === 'SANTRI')
    .map((user) => ({ id: user.id, studentCode: user.studentCode ?? '', name: user.name, status: user.status, activity: liveActivity(user.id) }));
  return [...SAMPLE_STUDENTS, ...live];
}

function evaluationSummary(now = Date.now()) {
  const statuses = db.submissions.map((submission) => ({ status: submissionStatus(submission, now), submittedAtMs: submission.submittedAtMs }));
  return {
    ...SAMPLE_EVALUATION,
    queued: SAMPLE_EVALUATION.queued + statuses.filter((s) => s.status === 'SUBMITTED').length,
    processing: SAMPLE_EVALUATION.processing + statuses.filter((s) => s.status === 'PROCESSING').length,
    failedLast24h: SAMPLE_EVALUATION.failedLast24h + statuses.filter((s) => s.status === 'FAILED' && now - s.submittedAtMs < DAY_MS).length,
  };
}

export const adminRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/admin/dashboard',
    access: 'ADMIN',
    handler: () => {
      const students = allStudents();
      const bests = students.flatMap((s) => s.activity.taskBests.map((t) => t.bestScore));
      return ok({
        totalStudents: students.length,
        activeStudents: students.filter((s) => s.status === 'ACTIVE').length,
        attemptsTotal: students.reduce((sum, s) => sum + s.activity.attemptCount, 0),
        // [ASUMSI] Rumus mock: rata-rata seluruh nilai terbaik per tugas; null bila belum ada hasil valid.
        averageScore: bests.length > 0 ? round2(bests.reduce((sum, score) => sum + score, 0) / bests.length) : null,
        averageProgressPct: students.length > 0 ? Math.round(students.reduce((sum, s) => sum + s.activity.learningProgressPct, 0) / students.length) : 0,
        evaluation: evaluationSummary(),
      });
    },
  },
  {
    method: 'GET',
    pattern: '/admin/dashboard/attention',
    access: 'ADMIN',
    handler: () =>
      ok(
        allStudents()
          // [ASUMSI] Hanya Santri aktif yang dipantau; SDD 3.17.3 tidak mengatur akun nonaktif.
          .filter((s) => s.status === 'ACTIVE')
          .map((s) => ({ studentId: s.id, studentCode: s.studentCode, name: s.name, ...attentionOf(s.activity) }))
          .filter((item) => item.reasons.length > 0),
      ),
  },
];
