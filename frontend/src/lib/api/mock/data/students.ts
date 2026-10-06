// [DATA CONTOH] Santri contoh untuk halaman Admin (dashboard A1, manajemen santri A2). Hanya mode mock.
// Aktivitasnya ditulis langsung (12 buatan tangan) atau dibangkitkan deterministik (sisanya); daftar
// "perlu diperhatikan" dihitung dari data ini dengan aturan SDD 3.17.3.
import type { AccountStatus } from '../../../../features/auth/types';
import type { StudentActivity } from '../rules';

export interface SampleStudent {
  id: string;
  studentCode: string;
  name: string;
  email: string;
  status: AccountStatus;
  joinedAt: string;
  /** Indeks tahapan tertinggi yang terbuka (0 = tahapan pertama), SDD 3.16.4. */
  highestStageIndex: number;
  activity: StudentActivity;
}

const at = (day: number, hour = 9) => `2026-09-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;

function student(index: number, name: string, status: AccountStatus, highestStageIndex: number, activity: StudentActivity): SampleStudent {
  const code = String(100 + index).padStart(6, '0');
  const slug = name.toLowerCase().replace(/[^a-z]+/g, '.');
  return { id: `usr-contoh-${index}`, studentCode: `YSR-${code}`, name, email: `${slug}@contoh.yusro.mock`, status, joinedAt: at(1 + (index % 10)), highestStageIndex, activity };
}

const HANDCRAFTED: SampleStudent[] = [
  student(1, 'Ahmad Fauzi', 'ACTIVE', 6, {
    learningProgressPct: 78,
    availableTasks: 12,
    attemptCount: 14,
    taskBests: [
      { taskId: 'contoh-t1', bestScore: 84, lastAttemptAt: at(10) },
      { taskId: 'contoh-t2', bestScore: 90, lastAttemptAt: at(14) },
    ],
  }),
  // Progress rendah.
  student(2, 'Siti Aisyah', 'ACTIVE', 1, {
    learningProgressPct: 22,
    availableTasks: 4,
    attemptCount: 3,
    taskBests: [{ taskId: 'contoh-t1', bestScore: 72, lastAttemptAt: at(8) }],
  }),
  // Nilai menurun (88 → 71).
  student(3, 'Budi Santoso', 'ACTIVE', 5, {
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
  student(4, 'Rina Marlina', 'ACTIVE', 1, { learningProgressPct: 18, availableTasks: 6, attemptCount: 0, taskBests: [] }),
  student(5, 'Muhammad Rizki', 'ACTIVE', 8, {
    learningProgressPct: 91,
    availableTasks: 18,
    attemptCount: 25,
    taskBests: [
      { taskId: 'contoh-t1', bestScore: 92.5, lastAttemptAt: at(12) },
      { taskId: 'contoh-t2', bestScore: 95, lastAttemptAt: at(16) },
    ],
  }),
  // Progress rendah dan nilai menurun (79,5 → 62).
  student(6, 'Nur Halimah', 'ACTIVE', 3, {
    learningProgressPct: 41,
    availableTasks: 8,
    attemptCount: 6,
    taskBests: [
      { taskId: 'contoh-t1', bestScore: 79.5, lastAttemptAt: at(11) },
      { taskId: 'contoh-t2', bestScore: 62, lastAttemptAt: at(17) },
    ],
  }),
  student(7, 'Fajar Ramadhan', 'ACTIVE', 4, {
    learningProgressPct: 55,
    availableTasks: 9,
    attemptCount: 7,
    taskBests: [
      { taskId: 'contoh-t1', bestScore: 75, lastAttemptAt: at(13) },
      // Turun 8 poin: di bawah ambang 10, tidak termasuk "nilai menurun".
      { taskId: 'contoh-t2', bestScore: 67, lastAttemptAt: at(18) },
    ],
  }),
  student(8, "Dewi Ma'rifah", 'ACTIVE', 5, {
    learningProgressPct: 70,
    availableTasks: 11,
    attemptCount: 12,
    taskBests: [{ taskId: 'contoh-t1', bestScore: 86, lastAttemptAt: at(14) }],
  }),
  // Nonaktif: tidak dihitung di daftar "perlu diperhatikan".
  student(9, 'Hasan Basri', 'INACTIVE', 0, { learningProgressPct: 12, availableTasks: 4, attemptCount: 0, taskBests: [] }),
  student(10, 'Laila Zahra', 'ACTIVE', 4, {
    learningProgressPct: 50,
    availableTasks: 9,
    attemptCount: 8,
    taskBests: [{ taskId: 'contoh-t1', bestScore: 81, lastAttemptAt: at(15) }],
  }),
  student(11, 'Yusuf Hidayat', 'ACTIVE', 7, {
    learningProgressPct: 83,
    availableTasks: 14,
    attemptCount: 16,
    taskBests: [
      { taskId: 'contoh-t1', bestScore: 77, lastAttemptAt: at(9) },
      { taskId: 'contoh-t2', bestScore: 89, lastAttemptAt: at(19) },
    ],
  }),
  student(12, 'Aminah Putri', 'INACTIVE', 2, {
    learningProgressPct: 35,
    availableTasks: 5,
    attemptCount: 2,
    taskBests: [{ taskId: 'contoh-t1', bestScore: 68, lastAttemptAt: at(4) }],
  }),
];

const FIRST_NAMES = ['Abdullah', 'Aisyah', 'Bilal', 'Fatimah', 'Hamzah', 'Khadijah', 'Umar', 'Zainab', 'Ali', 'Maryam', 'Ibrahim', 'Salma', 'Yahya', 'Hafsah', 'Ismail', 'Ruqayyah', 'Zaid', 'Safiyyah', 'Anas', 'Sumayyah'];
const LAST_NAMES = ['Pratama', 'Saputra', 'Lestari', 'Nugroho', 'Wahyuni', 'Hidayah', 'Kurniawan', 'Rahmawati', 'Setiawan', 'Permata', 'Siregar', 'Nasution', 'Harahap', 'Ramadhani', 'Fitriani'];

/** Bilangan acak deterministik (LCG) agar data contoh sama di setiap muat ulang dan test. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function generated(index: number): SampleStudent {
  const random = seeded(index * 7919);
  const pct = Math.floor(random() * 101);
  const attemptCount = pct < 15 && random() < 0.5 ? 0 : 1 + Math.floor(random() * 20);
  const bestCount = attemptCount === 0 ? 0 : Math.min(attemptCount, 1 + Math.floor(random() * 3));
  const taskBests = Array.from({ length: bestCount }, (_, task) => ({
    taskId: `contoh-t${task + 1}`,
    bestScore: Math.round((55 + random() * 45) * 2) / 2,
    lastAttemptAt: at(2 + task * 8 + Math.floor(random() * 7), 8 + (index % 10)),
  }));
  const highestStageIndex = Math.min(9, Math.floor(pct / 11));
  // Pasangan (index mod 20, index mod 15) unik untuk 60 indeks berurutan, jadi nama tidak berulang.
  const name = `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[index % LAST_NAMES.length]}`;
  return student(index, name, index % 7 === 0 ? 'INACTIVE' : 'ACTIVE', highestStageIndex, {
    learningProgressPct: pct,
    availableTasks: 2 * (highestStageIndex + 1) + Math.floor(random() * 4),
    attemptCount,
    taskBests,
  });
}

const GENERATED_COUNT = 35;

/** Data awal; db menyalinnya agar status bisa diubah dan direset. */
export function seedSampleStudents(): SampleStudent[] {
  return [...HANDCRAFTED, ...Array.from({ length: GENERATED_COUNT }, (_, offset) => generated(13 + offset))].map((item) => ({ ...item, activity: { ...item.activity } }));
}

/** [DATA CONTOH] Kondisi layanan evaluasi di luar submission akun demo. */
export const SAMPLE_EVALUATION = { queued: 1, processing: 0, failedLast24h: 2, serviceStatus: 'ok', modelVersion: 'yusro-mlp-v1.2.0' };
