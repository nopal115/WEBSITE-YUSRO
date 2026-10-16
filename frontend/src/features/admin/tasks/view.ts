import type { ContentAction } from '../content/view';
import type { QuestionInput, TaskType, TaskUpdateInput } from './types';

/** Nama jenis tugas sesuai SRS FR-TASK-03. */
export const TYPE_LABEL: Record<TaskType, string> = { QUIZ: 'Dengar-Pilih', IMITATION: 'Dengar-Tirukan' };

export const TITLE_MAX = 200;
export const OPTIONS_MIN = 2;
/** [ASUMSI] Batas atas pilihan per soal; SDD hanya mengatur minimal dua. */
export const OPTIONS_MAX = 6;

/**
 * Aksi status tugas memakai aturan konten (SDD 3.5.3, availableActions di content/view.ts). Mengaktifkan
 * selalu lewat publish agar kelengkapan diperiksa (SDD 5.17); perubahan lain lewat PATCH status.
 */
export type TaskStatusRequest = { kind: 'publish' } | { kind: 'update'; input: TaskUpdateInput } | { kind: 'delete' };

export function statusRequest(action: ContentAction): TaskStatusRequest {
  if (action === 'activate' || action === 'reactivate') return { kind: 'publish' };
  if (action === 'delete') return { kind: 'delete' };
  return { kind: 'update', input: { status: action === 'deactivate' ? 'INACTIVE' : 'DRAFT' } };
}

export interface QuestionErrors {
  prompt?: string;
  audioId?: string;
  options?: string;
  /** Galat per pilihan, menurut indeks. */
  optionLabels: Record<number, string>;
}

/** Validasi soal sebelum dikirim (SDD 5.17): pertanyaan, audio, minimal dua pilihan berteks, tepat satu benar. */
export function validateQuestion(input: QuestionInput): QuestionErrors | null {
  const errors: QuestionErrors = { optionLabels: {} };
  if (!input.prompt.trim()) errors.prompt = 'Pertanyaan wajib diisi.';
  if (!input.audioId) errors.audioId = 'Pilih audio soal.';
  input.options.forEach((option, index) => {
    if (!option.label.trim()) errors.optionLabels[index] = 'Teks pilihan wajib diisi.';
  });
  if (input.options.length < OPTIONS_MIN) errors.options = `Minimal ${OPTIONS_MIN} pilihan jawaban.`;
  else if (input.options.filter((option) => option.isCorrect).length !== 1) errors.options = 'Tandai tepat satu jawaban benar.';
  const hasError = errors.prompt || errors.audioId || errors.options || Object.keys(errors.optionLabels).length > 0;
  return hasError ? errors : null;
}

/** Ringkasan kelengkapan untuk daftar tugas. */
export function completenessText(task: { type: TaskType; questionCount: number | null; referenceAudio: unknown; isComplete: boolean }): string {
  if (task.type === 'QUIZ') return `${task.questionCount ?? 0} soal`;
  return task.referenceAudio ? 'Audio referensi terpasang' : 'Audio referensi belum dipilih';
}
