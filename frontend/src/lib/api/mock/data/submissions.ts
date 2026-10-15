// [DATA CONTOH] Submission Dengar-Tirukan santri contoh untuk Monitoring (A3). Hanya mode mock.
// Waktu dibuat relatif terhadap saat data disiapkan, agar "24 jam terakhir" dan status beku tetap bermakna.
import type { SubmissionRecord } from '../db';
import { CONTENT } from './content';
import type { SampleStudent } from './students';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

type Spec = { studentId: string; status: 'EVALUATED' | 'FAILED' | 'SUBMITTED' | 'PROCESSING'; agoMs: number; score?: number; errorCode?: string };

/** Tugas Dengar-Tirukan pada tahapan yang terbuka, mulai indeks ke-6 agar tidak bertabrakan dengan riwayat sintetis A2. */
function imitationTasks(student: SampleStudent) {
  const openStages = new Set(CONTENT.stages.slice(0, student.highestStageIndex + 1).map((stage) => stage.id));
  const openMaterials = new Set(CONTENT.materials.filter((material) => openStages.has(material.stageId)).map((material) => material.id));
  return CONTENT.tasks.filter((task) => openMaterials.has(task.materialId)).slice(6).filter((task) => task.type === 'IMITATION');
}

function specs(students: SampleStudent[]): Spec[] {
  // Santri buatan tangan: hanya status yang bukan hasil valid, agar ringkasan dan aturan "perhatian" A1/A2 tidak berubah.
  const list: Spec[] = [
    { studentId: 'usr-contoh-5', status: 'FAILED', agoMs: 3 * HOUR_MS, errorCode: 'ML_TIMEOUT' },
    { studentId: 'usr-contoh-8', status: 'FAILED', agoMs: 30 * HOUR_MS, errorCode: 'AUDIO_DECODE_FAILED' },
    { studentId: 'usr-contoh-10', status: 'SUBMITTED', agoMs: 4 * MINUTE_MS },
    { studentId: 'usr-contoh-11', status: 'PROCESSING', agoMs: 6 * MINUTE_MS },
    { studentId: 'usr-contoh-11', status: 'FAILED', agoMs: 50 * HOUR_MS, errorCode: 'ML_UNAVAILABLE' },
    { studentId: 'usr-contoh-12', status: 'FAILED', agoMs: 5 * DAY_MS, errorCode: 'ML_TIMEOUT' },
  ];
  // Santri bangkitan yang sudah pernah mengerjakan tugas: satu hasil EVALUATED, sebagian ditambah status lain.
  students
    .filter((student) => Number(student.id.split('-').pop()) >= 13 && student.activity.attemptCount > 0)
    .slice(0, 20)
    .forEach((student, index) => {
      list.push({ studentId: student.id, status: 'EVALUATED', agoMs: (2 + index) * DAY_MS + index * HOUR_MS, score: 60 + ((index * 37) % 39) + (index % 2) * 0.5 });
      if (index % 5 === 0) list.push({ studentId: student.id, status: 'FAILED', agoMs: (1 + index) * DAY_MS, errorCode: 'AUDIO_DECODE_FAILED' });
      if (index === 7) list.push({ studentId: student.id, status: 'SUBMITTED', agoMs: 2 * MINUTE_MS });
    });
  return list;
}

export function seedSampleSubmissions(students: SampleStudent[], now = Date.now()): SubmissionRecord[] {
  const byId = new Map(students.map((student) => [student.id, student]));
  const records: SubmissionRecord[] = [];
  specs(students)
    .slice()
    .sort((a, b) => b.agoMs - a.agoMs)
    .forEach((spec, index) => {
      const student = byId.get(spec.studentId);
      const tasks = student ? imitationTasks(student) : [];
      if (!student || tasks.length === 0) return;
      const task = tasks[index % Math.min(tasks.length, 3)];
      const attemptNo = records.filter((record) => record.userId === student.id && record.taskId === task.id).length + 1;
      const pinned = spec.status === 'SUBMITTED' || spec.status === 'PROCESSING' ? spec.status : undefined;
      records.push({
        id: `sub-contoh-${index + 1}`,
        userId: student.id,
        taskId: task.id,
        attemptNo,
        submittedAtMs: now - spec.agoMs,
        idempotencyKey: null,
        outcome: spec.status === 'FAILED' ? 'FAILED' : 'EVALUATED',
        score: spec.status === 'EVALUATED' ? (spec.score ?? 80) : null,
        // Status SUBMITTED/PROCESSING contoh "dibekukan" agar tetap terlihat di Monitoring.
        pinnedStatus: pinned,
        errorCode: spec.errorCode ?? null,
      });
    });
  return records;
}
