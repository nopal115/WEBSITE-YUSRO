// Kontrak Admin Tugas & Soal SDD 5.17, 3.7, 4.5.9–4.5.10. Bentuk respons yang tidak dirinci SDD ditandai [ASUMSI].
import type { ContentStatus } from '../content/types';
import type { TaskType } from '../../../lib/api/types';

export type { ContentStatus, TaskType };

export interface AudioRef {
  id: string;
  originalName: string;
  durationMs: number;
  status: 'ACTIVE' | 'ARCHIVED';
}

/** [ASUMSI] Butir GET admin/tasks. Field AS30 (id, title, type, materialTitle, status) tetap ada untuk filter Monitoring. */
export interface AdminTask {
  id: string;
  title: string;
  type: TaskType;
  materialId: string;
  materialTitle: string;
  stageId: string;
  stageTitle: string;
  orderIndex: number;
  status: ContentStatus;
  /** Jumlah soal untuk QUIZ; null untuk IMITATION. */
  questionCount: number | null;
  /** Audio referensi yang berlaku untuk IMITATION; null untuk QUIZ atau bila belum dipilih. */
  referenceAudio: AudioRef | null;
  /** Pernah dikerjakan Santri: tidak dapat dihapus atau dikembalikan ke draf (BR-DELETE-02). */
  isReferenced: boolean;
  /** Komponen sesuai jenis sudah lengkap sehingga boleh diaktifkan (SDD 3.7.3). */
  isComplete: boolean;
}

/** [ASUMSI] GET admin/tasks/:id. */
export interface AdminTaskDetail extends AdminTask {
  instruction: string | null;
  referenceAudioId: string | null;
  /** [ASUMSI] Teks Arab yang ditirukan Santri (ditampilkan di halaman Dengar-Tirukan); tidak disebut SDD 4.5.9. */
  arabicText: string | null;
}

export interface TaskCreateInput {
  materialId: string;
  type: TaskType;
  title: string;
}

/** PATCH admin/tasks/:id: hanya kolom yang dikirim yang berubah. Status AKTIF hanya lewat publish. */
export interface TaskUpdateInput {
  title?: string;
  instruction?: string;
  arabicText?: string;
  referenceAudioId?: string;
  status?: Exclude<ContentStatus, 'ACTIVE'>;
}

export interface AdminOption {
  id: string;
  label: string;
  arabicLabel: string;
  orderIndex: number;
  isCorrect: boolean;
}

/** [ASUMSI] Soal pada jalur Admin; isCorrect tidak pernah dikirim ke Santri (SDD 3.7.4). */
export interface AdminQuestion {
  id: string;
  orderIndex: number;
  prompt: string;
  audioId: string;
  audio: AudioRef | null;
  options: AdminOption[];
}

/** Body POST admin/tasks/:id/questions dan PATCH admin/questions/:id (SDD 5.17). */
export interface QuestionInput {
  prompt: string;
  audioId: string;
  options: { label: string; arabicLabel: string; isCorrect: boolean }[];
}
