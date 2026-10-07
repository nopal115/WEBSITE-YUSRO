// Endpoint Monitoring Admin SDD 5.18 (+ GET admin/tasks minimal, SDD 5.17). Bentuk respons yang tidak
// dirinci SDD ditandai [ASUMSI] dan dicatat di docs/api-contract.md.
import { formatDateStamp } from '../../../utils/format';
import { getEvaluationService, takeNextEvaluation } from '../controls';
import { CONTENT } from '../data/content';
import { db, newId, submissionStatus, type SubmissionRecord } from '../db';
import { fail, httpError, ok, paginate } from '../http';
import { mockAudioUrl } from '../media';
import type { MockRoute } from '../router';
import { feedbackCategory, FINISHED_AFTER_MS } from '../rules';
import { studentRecords } from '../students';
import { taskInfo } from '../views';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
/** SDD 3.17.4: URL rekaman untuk Admin berlaku 5 menit. */
const RECORDING_URL_SECONDS = 300;
const MODEL_VERSION = 'yusro-mlp-v1.2.0';
const FINAL = new Set(['EVALUATED', 'FAILED']);

/** [ASUMSI] Kondisi layanan evaluasi (GET admin/evaluation/health); juga dipakai dashboard admin. */
export function serviceHealth(now = Date.now()) {
  const state = getEvaluationService();
  return {
    serviceStatus: state,
    modelVersion: state === 'ok' ? MODEL_VERSION : null,
    modelLoaded: state === 'ok',
    checkedAt: new Date(now).toISOString(),
  };
}

const finishedAtMs = (submission: SubmissionRecord) => (submission.retriedAtMs ?? submission.submittedAtMs) + FINISHED_AFTER_MS;

/** Jumlah per status evaluasi; EVALUATED dan FAILED dihitung 24 jam terakhir. [ASUMSI] */
export function queueCounts(now = Date.now()) {
  const counts = { SUBMITTED: 0, PROCESSING: 0, EVALUATED: 0, FAILED: 0 };
  let oldestWaitingMs: number | null = null;
  for (const submission of db.submissions) {
    const status = submissionStatus(submission, now);
    if (FINAL.has(status)) {
      if (now - finishedAtMs(submission) < DAY_MS) counts[status] += 1;
      continue;
    }
    counts[status] += 1;
    const waitingSince = submission.retriedAtMs ?? submission.submittedAtMs;
    if (status === 'SUBMITTED' && (oldestWaitingMs === null || waitingSince < oldestWaitingMs)) oldestWaitingMs = waitingSince;
  }
  return { counts, oldestWaitingSince: oldestWaitingMs === null ? null : new Date(oldestWaitingMs).toISOString() };
}

/** [ASUMSI] Butir GET admin/submissions; withErrorCode untuk detail /:id. */
function submissionItem(submission: SubmissionRecord, students: Map<string, { studentCode: string; name: string }>, now: number, withErrorCode = false) {
  const status = submissionStatus(submission, now);
  const student = students.get(submission.userId);
  const score = status === 'EVALUATED' ? submission.score : null;
  return {
    submissionId: submission.id,
    attemptNo: submission.attemptNo,
    studentId: submission.userId,
    studentCode: student?.studentCode ?? '',
    studentName: student?.name ?? '',
    taskId: submission.taskId,
    ...taskInfo(submission.taskId),
    evaluationStatus: status,
    score,
    feedbackCategory: score === null ? null : feedbackCategory(score),
    submittedAt: new Date(submission.submittedAtMs).toISOString(),
    evaluatedAt: status === 'EVALUATED' ? new Date(finishedAtMs(submission)).toISOString() : null,
    failedAt: status === 'FAILED' ? new Date(finishedAtMs(submission)).toISOString() : null,
    ...(withErrorCode ? { errorCode: status === 'FAILED' ? (submission.errorCode ?? 'ML_TIMEOUT') : null } : {}),
  };
}

const studentIndex = () => new Map(studentRecords().map((record) => [record.id, { studentCode: record.studentCode, name: record.name }]));

function findSubmission(id: string): SubmissionRecord {
  const submission = db.submissions.find((item) => item.id === id);
  if (!submission) throw httpError(404, 'NOT_FOUND', 'Data tidak ditemukan.');
  return submission;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const monitoringRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/admin/submissions',
    access: 'ADMIN',
    handler: (req) => {
      const now = Date.now();
      const status = req.query.get('status');
      const taskId = req.query.get('taskId');
      const studentId = req.query.get('studentId');
      const from = req.query.get('from');
      const to = req.query.get('to');
      if ((from && !DATE_PATTERN.test(from)) || (to && !DATE_PATTERN.test(to)) || (from && to && from > to)) {
        return fail(422, 'VALIDATION_ERROR', 'Rentang tanggal tidak valid.', [{ field: 'to', message: 'Tanggal akhir tidak boleh lebih awal dari tanggal awal.' }]);
      }
      const students = studentIndex();
      // Penyaringan di "server" (SDD 3.16.4 / NFR-PERF-04); tanggal dibandingkan per hari, inklusif. [ASUMSI]
      const items = db.submissions
        .filter((submission) => {
          if (taskId && submission.taskId !== taskId) return false;
          if (studentId && submission.userId !== studentId) return false;
          const day = formatDateStamp(new Date(submission.submittedAtMs));
          if (from && day < from) return false;
          if (to && day > to) return false;
          return !status || submissionStatus(submission, now) === status;
        })
        .sort((a, b) => b.submittedAtMs - a.submittedAtMs)
        .map((submission) => submissionItem(submission, students, now));
      const query = new URLSearchParams(req.query);
      if (Number(query.get('limit')) > MAX_LIMIT) query.set('limit', String(MAX_LIMIT));
      const { data, meta } = paginate(items, query, DEFAULT_LIMIT);
      return ok(data, { meta });
    },
  },
  {
    method: 'GET',
    pattern: '/admin/submissions/:id',
    access: 'ADMIN',
    handler: (req) => ok(submissionItem(findSubmission(req.params.id), studentIndex(), Date.now(), true)),
  },
  {
    // [ASUMSI] { url, expiresInSeconds }; URL rekaman hanya diterbitkan saat diminta (SDD 3.17.4, NFR-PRIV-02).
    method: 'GET',
    pattern: '/admin/submissions/:id/recording-url',
    access: 'ADMIN',
    handler: (req) => {
      const submission = findSubmission(req.params.id);
      return ok({ url: mockAudioUrl(`recording:${submission.id}`, 3200), expiresInSeconds: RECORDING_URL_SECONDS });
    },
  },
  {
    // SDD 5.18 / 3.11.7: hanya FAILED; tidak membuat percobaan baru (attemptNo dan waktu kirim tetap).
    method: 'POST',
    pattern: '/admin/submissions/:id/retry',
    access: 'ADMIN',
    handler: (req) => {
      const submission = findSubmission(req.params.id);
      const now = Date.now();
      if (submissionStatus(submission, now) !== 'FAILED') {
        // [ASUMSI] Kalimat pesan; SDD hanya menyebut kode galatnya.
        return fail(409, 'EVAL_RETRY_NOT_ALLOWED', 'Evaluasi ulang hanya dapat diminta untuk submission yang gagal diproses.');
      }
      const outcome = takeNextEvaluation() ?? 'EVALUATED';
      submission.retriedAtMs = now;
      submission.pinnedStatus = undefined;
      submission.outcome = outcome;
      submission.errorCode = outcome === 'FAILED' ? 'ML_TIMEOUT' : null;
      // [DATA CONTOH] Skor tiruan 60,00–98,99.
      submission.score = outcome === 'EVALUATED' ? Math.round(6000 + ((submission.attemptNo * 3779 + submission.id.length * 977) % 3900)) / 100 : null;
      return ok(
        { submissionId: submission.id, evaluationStatus: 'SUBMITTED', attemptNo: submission.attemptNo, jobId: newId('job'), isRetry: true },
        { status: 202, message: 'Evaluasi ulang dijadwalkan.' },
      );
    },
  },
  {
    method: 'GET',
    pattern: '/admin/evaluation/queue',
    access: 'ADMIN',
    handler: () => ok(queueCounts()),
  },
  {
    method: 'GET',
    pattern: '/admin/evaluation/health',
    access: 'ADMIN',
    handler: () => ok(serviceHealth()),
  },
  {
    // [ASUMSI] Bentuk minimal untuk filter tugas; SDD 5.17 tidak merinci respons. ?type= menyaring jenis tugas.
    method: 'GET',
    pattern: '/admin/tasks',
    access: 'ADMIN',
    handler: (req) => {
      const type = req.query.get('type');
      return ok(
        CONTENT.tasks
          .filter((task) => !type || task.type === type)
          .map((task) => ({ id: task.id, title: task.title, type: task.type, materialTitle: taskInfo(task.id).materialTitle, status: 'ACTIVE' })),
      );
    },
  },
];
