// SDD 5.11 (progress, riwayat), 5.12 (statistik), 5.13 (laporan PDF).
import type { HistoryItem } from '../../../../features/progress/types';
import type { EvaluationStatus } from '../../types';
import { CONTENT } from '../data/content';
import { accessFor, completions, findMaterial, findUser, isTaskCompleted, progressSnapshot, quizAttemptsOf, submissionsOf, submissionStatus, tasksOf, validResults } from '../db';
import { ok, paginate } from '../http';
import { mockPdf } from '../media';
import type { MockRoute } from '../router';
import { chartTrend, round2 } from '../rules';

/** [ASUMSI] Label riwayat untuk SUBMITTED dan PROCESSING tidak dirinci SDD. */
const DISPLAY_STATUS: Record<EvaluationStatus, string> = {
  SUBMITTED: 'Dikirim',
  PROCESSING: 'Sedang diproses',
  EVALUATED: 'Selesai',
  FAILED: 'Gagal diproses',
};

const taskInfo = (taskId: string) => {
  const task = CONTENT.tasks.find((t) => t.id === taskId);
  return { taskTitle: task?.title ?? '', materialTitle: task ? findMaterial(task.materialId).title : '' };
};

export const progressRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/progress',
    access: 'SANTRI',
    handler: (req) => {
      const userId = req.userId as string;
      const snapshot = progressSnapshot(userId);
      const { stageAccess } = accessFor(userId);
      const done = completions(userId);
      return ok({
        learningProgressPct: snapshot.learningProgressPct,
        materials: { completed: snapshot.materialsCompleted, total: snapshot.materialsTotal, pct: snapshot.materialsPct },
        tasks: { completed: snapshot.tasksCompleted, total: snapshot.tasksTotal, pct: snapshot.tasksPct },
        stages: CONTENT.stages.map((stage) => {
          // [ASUMSI] pct per tahapan = (materi + tugas selesai) / (materi + tugas) pada tahapan itu.
          const materials = CONTENT.materials.filter((m) => m.stageId === stage.id);
          const tasks = materials.flatMap((m) => tasksOf(m.id));
          const finished = materials.filter((m) => done.has(m.id)).length + tasks.filter((t) => isTaskCompleted(userId, t)).length;
          return { id: stage.id, title: stage.title, access: stageAccess.get(stage.id), pct: Math.round((finished / (materials.length + tasks.length)) * 100) };
        }),
      });
    },
  },
  {
    method: 'GET',
    pattern: '/progress/history',
    access: 'SANTRI',
    handler: (req) => {
      const userId = req.userId as string;
      const now = Date.now();
      const quiz: HistoryItem[] = quizAttemptsOf(userId).map((a) => ({
        attemptId: a.id,
        taskId: a.taskId,
        ...taskInfo(a.taskId),
        taskType: 'QUIZ',
        attemptNo: a.attemptNo,
        score: a.score,
        evaluationStatus: null,
        displayStatus: 'Selesai',
        submittedAt: a.submittedAt,
      }));
      const imitation: HistoryItem[] = submissionsOf(userId).map((s) => {
        const status = submissionStatus(s, now);
        return {
          attemptId: s.id,
          taskId: s.taskId,
          ...taskInfo(s.taskId),
          taskType: 'IMITATION',
          attemptNo: s.attemptNo,
          score: status === 'EVALUATED' ? s.score : null,
          evaluationStatus: status,
          displayStatus: DISPLAY_STATUS[status],
          submittedAt: new Date(s.submittedAtMs).toISOString(),
        };
      });
      const items = [...quiz, ...imitation].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
      const { data, meta } = paginate(items, req.query, 20);
      return ok(data, { meta });
    },
  },
  {
    method: 'GET',
    pattern: '/statistics',
    access: 'SANTRI',
    handler: (req) => {
      const userId = req.userId as string;
      const now = Date.now();
      const results = validResults(userId, now);
      // Nilai terbaik per tugas, lalu rata-ratanya (SDD 3.14.2).
      const best = new Map<string, number>();
      results.forEach((r) => best.set(r.taskId, Math.max(best.get(r.taskId) ?? 0, r.score)));
      const bests = [...best.values()];
      const snapshot = progressSnapshot(userId);
      return ok({
        materialsCompleted: snapshot.materialsCompleted,
        tasksCompleted: snapshot.tasksCompleted,
        averageScore: bests.length ? round2(bests.reduce((sum, value) => sum + value, 0) / bests.length) : null,
        bestScore: bests.length ? Math.max(...bests) : null,
        learningProgressPct: snapshot.learningProgressPct,
        evaluatedAttempts: results.length,
        failedAttempts: submissionsOf(userId).filter((s) => submissionStatus(s, now) === 'FAILED').length,
      });
    },
  },
  {
    method: 'GET',
    pattern: '/statistics/chart',
    access: 'SANTRI',
    handler: (req) => {
      const points = validResults(req.userId as string).map((r, index) => ({
        sequence: index + 1,
        attemptId: r.attemptId,
        taskTitle: taskInfo(r.taskId).taskTitle,
        score: r.score,
        submittedAt: r.submittedAt,
      }));
      return ok({ points, trend: chartTrend(points.map((p) => p.score)) });
    },
  },
  {
    method: 'GET',
    pattern: '/report/pdf',
    access: 'SANTRI',
    handler: (req) => {
      const user = findUser(req.userId);
      const date = new Date().toISOString().slice(0, 10);
      return {
        status: 200,
        blob: mockPdf(`Laporan Yusro [DATA CONTOH] - ${user.studentCode} - ${date}`),
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Laporan-${user.studentCode}-${date}.pdf"` },
      };
    },
  },
];
