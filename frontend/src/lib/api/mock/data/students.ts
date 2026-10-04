// [DATA CONTOH] Santri contoh untuk halaman Admin (dashboard A1, daftar santri A2). Hanya mode mock.
// Aktivitasnya ditulis langsung; daftar "perlu diperhatikan" dihitung dari data ini dengan aturan SDD 3.17.3.
import type { AccountStatus } from '../../../../features/auth/types';
import type { StudentActivity } from '../rules';

export interface SampleStudent {
  id: string;
  studentCode: string;
  name: string;
  email: string;
  status: AccountStatus;
  joinedAt: string;
  activity: StudentActivity;
}

const at = (day: number, hour = 9) => `2026-09-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;

function student(index: number, name: string, status: AccountStatus, activity: StudentActivity): SampleStudent {
  const code = String(100 + index).padStart(6, '0');
  const slug = name.toLowerCase().replace(/[^a-z]+/g, '.');
  return { id: `usr-contoh-${index}`, studentCode: `YSR-${code}`, name, email: `${slug}@contoh.yusro.mock`, status, joinedAt: at(1 + (index % 10)), activity };
}

export const SAMPLE_STUDENTS: SampleStudent[] = [
  student(1, 'Ahmad Fauzi', 'ACTIVE', {
    learningProgressPct: 78,
    availableTasks: 12,
    attemptCount: 14,
    taskBests: [
      { taskId: 'contoh-t1', bestScore: 84, lastAttemptAt: at(10) },
      { taskId: 'contoh-t2', bestScore: 90, lastAttemptAt: at(14) },
    ],
  }),
  // Progress rendah.
  student(2, 'Siti Aisyah', 'ACTIVE', {
    learningProgressPct: 22,
    availableTasks: 4,
    attemptCount: 3,
    taskBests: [{ taskId: 'contoh-t1', bestScore: 72, lastAttemptAt: at(8) }],
  }),
  // Nilai menurun (88 → 71).
  student(3, 'Budi Santoso', 'ACTIVE', {
    learningProgressPct: 64,
    availableTasks: 10,
    attemptCount: 9,
    taskBests: [
      { taskId: 'contoh-t1', bestScore: 80, lastAttemptAt: at(5) },
      { taskId: 'contoh-t2', bestScore: 88, lastAttemptAt: at(9) },
      { taskId: 'contoh-t3', bestScore: 71, lastAttemptAt: at(15) },
    ],
  }),
  // Belum mengerjakan tugas (sekaligus progress rendah).
  student(4, 'Rina Marlina', 'ACTIVE', { learningProgressPct: 18, availableTasks: 6, attemptCount: 0, taskBests: [] }),
  student(5, 'Muhammad Rizki', 'ACTIVE', {
    learningProgressPct: 91,
    availableTasks: 18,
    attemptCount: 25,
    taskBests: [
      { taskId: 'contoh-t1', bestScore: 92.5, lastAttemptAt: at(12) },
      { taskId: 'contoh-t2', bestScore: 95, lastAttemptAt: at(16) },
    ],
  }),
  // Progress rendah dan nilai menurun (79,5 → 62).
  student(6, 'Nur Halimah', 'ACTIVE', {
    learningProgressPct: 41,
    availableTasks: 8,
    attemptCount: 6,
    taskBests: [
      { taskId: 'contoh-t1', bestScore: 79.5, lastAttemptAt: at(11) },
      { taskId: 'contoh-t2', bestScore: 62, lastAttemptAt: at(17) },
    ],
  }),
  student(7, 'Fajar Ramadhan', 'ACTIVE', {
    learningProgressPct: 55,
    availableTasks: 9,
    attemptCount: 7,
    taskBests: [
      { taskId: 'contoh-t1', bestScore: 75, lastAttemptAt: at(13) },
      // Turun 8 poin: di bawah ambang 10, tidak termasuk "nilai menurun".
      { taskId: 'contoh-t2', bestScore: 67, lastAttemptAt: at(18) },
    ],
  }),
  student(8, "Dewi Ma'rifah", 'ACTIVE', {
    learningProgressPct: 70,
    availableTasks: 11,
    attemptCount: 12,
    taskBests: [{ taskId: 'contoh-t1', bestScore: 86, lastAttemptAt: at(14) }],
  }),
  // Nonaktif: tidak dihitung di daftar "perlu diperhatikan".
  student(9, 'Hasan Basri', 'INACTIVE', { learningProgressPct: 12, availableTasks: 4, attemptCount: 0, taskBests: [] }),
  student(10, 'Laila Zahra', 'ACTIVE', {
    learningProgressPct: 50,
    availableTasks: 9,
    attemptCount: 8,
    taskBests: [{ taskId: 'contoh-t1', bestScore: 81, lastAttemptAt: at(15) }],
  }),
  student(11, 'Yusuf Hidayat', 'ACTIVE', {
    learningProgressPct: 83,
    availableTasks: 14,
    attemptCount: 16,
    taskBests: [
      { taskId: 'contoh-t1', bestScore: 77, lastAttemptAt: at(9) },
      { taskId: 'contoh-t2', bestScore: 89, lastAttemptAt: at(19) },
    ],
  }),
  student(12, 'Aminah Putri', 'INACTIVE', {
    learningProgressPct: 35,
    availableTasks: 5,
    attemptCount: 2,
    taskBests: [{ taskId: 'contoh-t1', bestScore: 68, lastAttemptAt: at(4) }],
  }),
];

/** [DATA CONTOH] Kondisi layanan evaluasi di luar submission akun demo. */
export const SAMPLE_EVALUATION = { queued: 1, processing: 0, failedLast24h: 2, serviceStatus: 'ok', modelVersion: 'yusro-mlp-v1.2.0' };
