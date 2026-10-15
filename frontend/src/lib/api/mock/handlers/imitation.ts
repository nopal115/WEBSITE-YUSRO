// SDD 5.10 / 3.10: satu evaluasi aktif per tugas (409), jeda 10 detik (429), status berpindah
// SUBMITTED → PROCESSING → EVALUATED/FAILED seiring waktu, skor FAILED selalu null.
import { takeNextEvaluation } from '../controls';
import { IMITATION_CONSTRAINTS } from '../data/content';
import {
  assertMaterialOpen,
  attemptCount,
  bestScore,
  db,
  findTask,
  newId,
  progressSnapshot,
  submissionsOf,
  submissionStatus,
  type SubmissionRecord,
} from '../db';
import { fail, ok, paginate, type MockRequest } from '../http';
import { mockAudioUrl } from '../media';
import type { MockRoute } from '../router';
import { FEEDBACK_LABEL, feedbackCategory, FINISHED_AFTER_MS, PROCESSING_AFTER_MS } from '../rules';

const IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000;
const FORMAT_NAMES: Record<string, string> = { 'audio/webm': 'WebM', 'audio/mp4': 'MP4' };
const baseType = (mime: string) => mime.split(';')[0].trim().toLowerCase();

const header = (req: MockRequest, name: string): string | null =>
  Object.entries(req.headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1] ?? null;

const iso = (ms: number) => new Date(ms).toISOString();

function statusView(submission: SubmissionRecord, now = Date.now()) {
  const status = submissionStatus(submission, now);
  const base = { submissionId: submission.id };
  if (status === 'SUBMITTED' || status === 'PROCESSING') {
    return {
      ...base,
      evaluationStatus: status,
      score: null,
      feedbackCategory: null,
      submittedAt: iso(submission.submittedAtMs),
      ...(status === 'PROCESSING' ? { processingStartedAt: iso(submission.submittedAtMs + PROCESSING_AFTER_MS) } : {}),
      elapsedMs: now - submission.submittedAtMs,
    };
  }
  if (status === 'FAILED') {
    return {
      ...base,
      evaluationStatus: status,
      score: null,
      feedbackCategory: null,
      failedAt: iso(submission.submittedAtMs + FINISHED_AFTER_MS),
      userMessage: 'Evaluasi gagal diproses. Silakan coba kembali.',
      canResubmit: true,
    };
  }
  const score = submission.score as number;
  const category = feedbackCategory(score);
  const { learningProgressPct, tasksCompleted } = progressSnapshot(submission.userId);
  return {
    ...base,
    evaluationStatus: status,
    score,
    feedbackCategory: category,
    feedbackLabel: FEEDBACK_LABEL[category],
    evaluatedAt: iso(submission.submittedAtMs + FINISHED_AFTER_MS),
    attemptNo: submission.attemptNo,
    bestScore: bestScore(submission.userId, submission.taskId),
    progress: { learningProgressPct, tasksCompleted },
  };
}

function acceptedView(submission: SubmissionRecord) {
  return {
    submissionId: submission.id,
    attemptNo: submission.attemptNo,
    evaluationStatus: 'SUBMITTED' as const,
    score: null,
    submittedAt: iso(submission.submittedAtMs),
    polling: POLLING,
  };
}

// Jadwal contoh SDD 5.10.
const POLLING = {
  recommendedSchedule: [
    { intervalMs: 3000, times: 5 },
    { intervalMs: 10000, times: 6 },
    { intervalMs: 30000, times: 6 },
  ],
  stopAfterMs: 300000,
};

const ACCEPTED = { status: 202, message: 'Rekaman diterima dan sedang dievaluasi.' };

export const imitationRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/imitation/tasks/:taskId',
    access: 'SANTRI',
    handler: (req) => {
      const userId = req.userId as string;
      const task = findTask(req.params.taskId, 'IMITATION');
      assertMaterialOpen(userId, task.materialId);
      const active = submissionsOf(userId, task.id).find((s) => ['SUBMITTED', 'PROCESSING'].includes(submissionStatus(s)));
      return ok({
        id: task.id,
        title: task.title,
        instruction: task.instruction,
        referenceAudio: { id: `ref-${task.id}`, url: mockAudioUrl(`reference:${task.id}`, task.referenceDurationMs), durationMs: task.referenceDurationMs },
        arabicText: task.arabicText,
        constraints: IMITATION_CONSTRAINTS,
        // [ASUMSI] Kontrak baru: polling ikut dikirim agar pemantauan saat halaman dibuka ulang memakai jadwal backend.
        activeSubmission: active ? { ...statusView(active), polling: POLLING } : null,
        attemptCount: attemptCount(userId, task),
        bestScore: bestScore(userId, task.id),
      });
    },
  },
  {
    method: 'POST',
    pattern: '/imitation/tasks/:taskId/submissions',
    access: 'SANTRI',
    handler: (req) => {
      const userId = req.userId as string;
      const task = findTask(req.params.taskId, 'IMITATION');
      assertMaterialOpen(userId, task.materialId);
      const now = Date.now();

      // Kunci yang sama dalam 10 menit mengembalikan submission yang sama (SDD 5.23).
      const key = header(req, 'Idempotency-Key');
      const repeated = key
        ? submissionsOf(userId, task.id).find((s) => s.idempotencyKey === key && now - s.submittedAtMs < IDEMPOTENCY_WINDOW_MS)
        : undefined;
      if (repeated) return ok(acceptedView(repeated), ACCEPTED);

      // Validasi berkas lebih dulu (SDD 3.10.4). [ASUMSI] Mock hanya memeriksa format dan ukuran,
      // tanpa decode durasi; durasi dijaga perekam di frontend dan divalidasi ulang backend asli.
      const file = typeof FormData !== 'undefined' && req.body instanceof FormData ? req.body.get('audio_file') : null;
      if (!(file instanceof Blob)) {
        return fail(422, 'VALIDATION_ERROR', 'Berkas rekaman wajib dikirim.', [{ field: 'audio_file', message: 'Berkas rekaman wajib dikirim.' }]);
      }
      const { acceptedFormats, maxSizeBytes, cooldownSeconds } = IMITATION_CONSTRAINTS;
      const accepted = acceptedFormats.map(baseType);
      if (!accepted.includes(baseType(file.type))) {
        const names = accepted.map((type) => FORMAT_NAMES[type] ?? type).join(' atau ');
        return fail(422, 'AUDIO_FORMAT_UNSUPPORTED', `Format audio tidak didukung. Gunakan ${names}.`);
      }
      if (file.size === 0) return fail(422, 'AUDIO_UNREADABLE', 'Berkas rekaman tidak dapat dibaca. Silakan rekam ulang.');
      if (file.size > maxSizeBytes) {
        return fail(413, 'AUDIO_TOO_LARGE', `Ukuran rekaman melebihi ${Math.round(maxSizeBytes / 1048576)} MB.`);
      }

      const previous = submissionsOf(userId, task.id);
      if (previous.some((s) => ['SUBMITTED', 'PROCESSING'].includes(submissionStatus(s, now)))) {
        return fail(409, 'IMITATION_ACTIVE_EXISTS', 'Masih ada rekaman yang sedang dievaluasi untuk tugas ini.');
      }
      const last = previous[previous.length - 1];
      if (last && now - last.submittedAtMs < cooldownSeconds * 1000) {
        return fail(429, 'IMITATION_COOLDOWN', 'Tunggu beberapa detik sebelum mengirim rekaman berikutnya.');
      }

      const outcome = takeNextEvaluation() ?? 'EVALUATED';
      const submission: SubmissionRecord = {
        id: newId('sub'),
        userId,
        taskId: task.id,
        attemptNo: previous.length + 1,
        submittedAtMs: now,
        idempotencyKey: key,
        outcome,
        // [DATA CONTOH] Skor tiruan 60,00–98,99; FAILED selalu null (NFR-REL-04).
        score: outcome === 'EVALUATED' ? Math.round(6000 + ((previous.length * 3779 + task.id.length * 977) % 3900)) / 100 : null,
      };
      db.submissions.push(submission);
      return ok(acceptedView(submission), ACCEPTED);
    },
  },
  {
    method: 'GET',
    pattern: '/imitation/submissions/:id',
    access: 'SANTRI',
    handler: (req) => {
      const submission = db.submissions.find((s) => s.id === req.params.id && s.userId === req.userId);
      if (!submission) return fail(404, 'NOT_FOUND', 'Data tidak ditemukan.');
      return ok(statusView(submission));
    },
  },
  {
    method: 'GET',
    pattern: '/imitation/tasks/:taskId/submissions',
    access: 'SANTRI',
    handler: (req) => {
      const task = findTask(req.params.taskId, 'IMITATION');
      const now = Date.now();
      const items = submissionsOf(req.userId as string, task.id)
        .slice()
        .reverse()
        .map((s) => {
          const status = submissionStatus(s, now);
          const score = status === 'EVALUATED' ? s.score : null;
          return {
            submissionId: s.id,
            attemptNo: s.attemptNo,
            evaluationStatus: status,
            score,
            feedbackCategory: score === null ? null : feedbackCategory(score),
            submittedAt: iso(s.submittedAtMs),
          };
        });
      const { data, meta } = paginate(items, req.query, 10);
      return ok(data, { meta });
    },
  },
];
