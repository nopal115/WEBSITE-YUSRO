// SDD 5.8 (learning + dashboard) dengan aturan buka-kunci SDD 3.8.3 dan penyelesaian 3.8.4.
import type { ContinueTarget, MaterialBlock, MaterialSummary, StageSummary } from '../../../../features/learning/types';
import { CONTENT } from '../data/content';
import {
  accessFor,
  assertMaterialOpen,
  attemptCount,
  bestScore,
  completions,
  db,
  findMaterial,
  findStage,
  findUser,
  isTaskCompleted,
  progressSnapshot,
  tasksOf,
  validResults,
} from '../db';
import { httpError, ok } from '../http';
import { mockAudioUrl } from '../media';
import type { MockRoute } from '../router';

const materialsOf = (stageId: string) => CONTENT.materials.filter((m) => m.stageId === stageId);

function tasksCompletedIn(userId: string, materialId: string): number {
  return tasksOf(materialId).filter((task) => isTaskCompleted(userId, task)).length;
}

/** [ASUMSI] Materi untuk dilanjutkan: terakhir dibuka dan belum selesai, atau materi tersedia berikutnya. */
function continueTarget(userId: string): ContinueTarget {
  const { materialStatus } = accessFor(userId);
  const lastId = db.lastOpened.get(userId);
  const candidate =
    (lastId && materialStatus.get(lastId) === 'AVAILABLE' ? CONTENT.materials.find((m) => m.id === lastId) : undefined) ??
    CONTENT.materials.find((m) => materialStatus.get(m.id) === 'AVAILABLE');
  return candidate ? { materialId: candidate.id, materialTitle: candidate.title, stageTitle: findStage(candidate.stageId).title } : null;
}

export const learningRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/learning/stages',
    access: 'SANTRI',
    handler: (req) => {
      const userId = req.userId as string;
      const { stageAccess } = accessFor(userId);
      const done = completions(userId);
      const stages: StageSummary[] = CONTENT.stages.map((stage, index) => {
        const materials = materialsOf(stage.id);
        const access = stageAccess.get(stage.id) ?? 'LOCKED';
        return {
          id: stage.id,
          code: stage.code,
          title: stage.title,
          orderIndex: stage.orderIndex,
          access,
          isCompleted: materials.filter((m) => m.isRequired).every((m) => done.has(m.id)),
          ...(access === 'LOCKED' ? { lockReason: `Selesaikan seluruh materi wajib pada Tahapan ${index}.` } : {}),
          materialsTotal: materials.length,
          materialsCompleted: materials.filter((m) => done.has(m.id)).length,
        };
      });
      return ok(stages);
    },
  },
  {
    method: 'GET',
    pattern: '/learning/stages/:stageId/materials',
    access: 'SANTRI',
    handler: (req) => {
      const userId = req.userId as string;
      const stage = findStage(req.params.stageId);
      const { stageAccess, materialStatus } = accessFor(userId);
      if (stageAccess.get(stage.id) === 'LOCKED') throw httpError(403, 'LEARNING_STAGE_LOCKED', 'Tahapan ini belum terbuka.');
      const materials: MaterialSummary[] = materialsOf(stage.id).map((m) => {
        const status = materialStatus.get(m.id) ?? 'LOCKED';
        const base = { id: m.id, code: m.code, title: m.title, orderIndex: m.orderIndex, isRequired: m.isRequired, status };
        return status === 'LOCKED'
          ? { ...base, lockReason: 'Selesaikan materi sebelumnya terlebih dahulu.' }
          : { ...base, taskCount: tasksOf(m.id).length, tasksCompleted: tasksCompletedIn(userId, m.id) };
      });
      return ok({ stage: { id: stage.id, title: stage.title, access: 'UNLOCKED' }, materials });
    },
  },
  {
    method: 'GET',
    pattern: '/learning/materials/:id',
    access: 'SANTRI',
    handler: (req) => {
      const userId = req.userId as string;
      const material = findMaterial(req.params.id);
      assertMaterialOpen(userId, material.id);
      db.lastOpened.set(userId, material.id);
      const { materialStatus } = accessFor(userId);
      const index = CONTENT.materials.indexOf(material);
      const previous = CONTENT.materials[index - 1];
      const next = CONTENT.materials[index + 1];
      const blocks: MaterialBlock[] = [
        { type: 'TEXT', orderIndex: 1, textContent: `[DATA CONTOH] Penjelasan materi ${material.code}.` },
        { type: 'TEXT', orderIndex: 2, arabicContent: material.letters.map((l) => l.arabic).join('  '), transliteration: material.letters.map((l) => l.label).join(', ') },
        ...material.practice.map((line, i) => ({ type: 'TEXT' as const, orderIndex: 3 + i, arabicContent: line })),
        { type: 'AUDIO', orderIndex: 3 + material.practice.length, audioUrl: mockAudioUrl(`material:${material.code}`, 2000), durationMs: 2000 },
      ];
      return ok({
        id: material.id,
        code: material.code,
        title: material.title,
        isRequired: material.isRequired,
        status: materialStatus.get(material.id),
        blocks,
        tasks: tasksOf(material.id).map((task) => ({
          id: task.id,
          type: task.type,
          title: task.title,
          status: isTaskCompleted(userId, task) ? 'COMPLETED' : 'AVAILABLE',
          bestScore: bestScore(userId, task.id),
          attemptCount: attemptCount(userId, task),
        })),
        navigation: {
          previousMaterialId: previous?.id ?? null,
          nextMaterialId: next?.id ?? null,
          nextMaterialLocked: next ? materialStatus.get(next.id) === 'LOCKED' : false,
        },
      });
    },
  },
  {
    method: 'POST',
    pattern: '/learning/materials/:id/complete',
    access: 'SANTRI',
    handler: (req) => {
      const userId = req.userId as string;
      const material = findMaterial(req.params.id);
      // SDD 3.8.4: backend hanya memverifikasi materi terbuka bagi Santri ini.
      assertMaterialOpen(userId, material.id);
      const before = accessFor(userId).stageAccess;
      const done = completions(userId);
      if (!done.has(material.id)) done.set(material.id, new Date().toISOString()); // idempoten
      const after = accessFor(userId).stageAccess;
      const unlocked = CONTENT.stages.find((s) => before.get(s.id) === 'LOCKED' && after.get(s.id) === 'UNLOCKED');
      const { learningProgressPct, materialsCompleted, materialsTotal, tasksCompleted, tasksTotal } = progressSnapshot(userId);
      return ok(
        {
          materialId: material.id,
          completedAt: done.get(material.id),
          progress: { learningProgressPct, materialsCompleted, materialsTotal, tasksCompleted, tasksTotal },
          stageUnlocked: unlocked ? { id: unlocked.id, code: unlocked.code, title: unlocked.title } : null,
        },
        { message: 'Materi ditandai selesai.' },
      );
    },
  },
  { method: 'GET', pattern: '/learning/continue', access: 'SANTRI', handler: (req) => ok(continueTarget(req.userId as string)) },
  {
    method: 'GET',
    pattern: '/dashboard',
    access: 'SANTRI',
    handler: (req) => {
      const userId = req.userId as string;
      const user = findUser(userId);
      const { materialStatus } = accessFor(userId);
      const progress = progressSnapshot(userId);
      const lastId = db.lastOpened.get(userId);
      const last = lastId ? CONTENT.materials.find((m) => m.id === lastId) : undefined;
      // [ASUMSI] Tugas belum selesai dari materi yang terbuka, maksimal 5.
      const unfinishedTasks = CONTENT.materials
        .filter((m) => materialStatus.get(m.id) !== 'LOCKED')
        .flatMap((m) => tasksOf(m.id).filter((t) => !isTaskCompleted(userId, t)).map((t) => ({ id: t.id, title: t.title, materialTitle: m.title })))
        .slice(0, 5);
      // Nilai percobaan terakhir yang memiliki nilai, bukan nilai terbaik (SDD 3.14.4).
      const results = validResults(userId);
      const latest = results[results.length - 1];
      const latestTask = latest ? CONTENT.tasks.find((t) => t.id === latest.taskId) : undefined;
      const target = continueTarget(userId);
      return ok({
        greeting: { name: user.name, studentCode: user.studentCode ?? '' },
        learningProgressPct: progress.learningProgressPct,
        lastMaterial: last ? { id: last.id, title: last.title, stageTitle: findStage(last.stageId).title } : null,
        unfinishedTasks,
        lastAttemptScore: latest && latestTask ? { score: latest.score, taskTitle: latestTask.title, submittedAt: latest.submittedAt } : null,
        materialsCompleted: progress.materialsCompleted,
        tasksCompleted: progress.tasksCompleted,
        continueTarget: target ? { materialId: target.materialId } : null,
      });
    },
  },
];
