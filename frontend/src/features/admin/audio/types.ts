// Kontrak Admin Audio SDD 5.16 dan 4.5.8 (audio_assets). Bentuk respons yang tidak dirinci SDD ditandai [ASUMSI].

/** SDD 3.6.2: jenis yang dikelola Admin; RECORDING dan DATASET tidak tampil di sini. */
export type AudioKind = 'LEARNING' | 'REFERENCE';
/** SRS UI-ADMIN-AUDIO-03: AKTIF atau ARSIP. */
export type AudioStatus = 'ACTIVE' | 'ARCHIVED';

/** [ASUMSI] Tugas Dengar-Tirukan yang memakai audio referensi. */
export interface AudioUsage {
  taskId: string;
  taskTitle: string;
  materialId: string;
  materialTitle: string;
}

/** [ASUMSI] Butir GET admin/audio: kolom audio_assets + penanda pemakaian. */
export interface AdminAudio {
  id: string;
  kind: AudioKind;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
  version: number;
  status: AudioStatus;
  replacesId: string | null;
  createdAt: string;
  /** Referensi yang sudah dipakai submission tidak dapat diarsipkan, hanya diganti versinya (SDD 7.7.19). */
  usedBySubmission: boolean;
  usage: AudioUsage | null;
}

/** [ASUMSI] GET admin/audio/:id: butir audio + seluruh rantai versi, terbaru dulu. */
export interface AdminAudioDetail extends AdminAudio {
  versions: AdminAudio[];
}

export interface AudioFilter {
  kind: AudioKind | '';
  status: AudioStatus | '';
}
