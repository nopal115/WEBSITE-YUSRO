// SDD 5.15 (konten) dan 5.16 (audio, minimal). Bentuk respons tidak dirinci SDD; semuanya [ASUMSI]
// dan dicatat di docs/api-contract.md.

/** SDD 4.5.5 content_status; ditampilkan sebagai DRAFT/AKTIF/NONAKTIF (SDD 7.7.18). */
export type ContentStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

/** [ASUMSI] Butir GET /admin/stages (versi lengkap; field id, code, title, orderIndex, status dipakai juga filter Daftar Santri). */
export interface AdminStage {
  id: string;
  /** [ASUMSI] Dibuat server, tampil sebagai teks tetap. */
  code: string;
  title: string;
  description: string | null;
  orderIndex: number;
  status: ContentStatus;
  materialCount: number;
  /** [ASUMSI] true bila sudah dirujuk progress/percobaan: hapus dan "kembalikan ke draf" tidak ditawarkan. */
  isReferenced: boolean;
}

/** [ASUMSI] Butir GET /admin/materials?stageId=. */
export interface AdminMaterial {
  id: string;
  stageId: string;
  code: string;
  title: string;
  summary: string | null;
  orderIndex: number;
  isRequired: boolean;
  status: ContentStatus;
  blockCount: number;
  taskCount: number;
  isReferenced: boolean;
}

/** [ASUMSI] Body POST/PATCH /admin/stages; status lewat PATCH { status } (keputusan Q3 A4). */
export interface StageInput {
  title?: string;
  description?: string | null;
  status?: ContentStatus;
}

/** [ASUMSI] Body POST/PATCH /admin/materials; stageId hanya saat tambah (materi tidak dipindah tahapan). */
export interface MaterialInput {
  stageId?: string;
  title?: string;
  summary?: string | null;
  isRequired?: boolean;
  status?: ContentStatus;
}

export type BlockType = 'TEXT' | 'AUDIO' | 'IMAGE';

/** [ASUMSI] Butir GET /admin/materials/:id/blocks (kolom SDD 4.5.7). */
export interface AdminBlock {
  id: string;
  type: BlockType;
  orderIndex: number;
  textContent: string | null;
  arabicContent: string | null;
  transliteration: string | null;
  imageUrl: string | null;
  audioId: string | null;
  audio: { id: string; originalName: string; durationMs: number } | null;
}

/** [ASUMSI] Satu blok pada body PUT /admin/materials/:id/blocks; urutan = urutan larik. */
export interface BlockInput {
  id?: string;
  type: BlockType;
  textContent?: string;
  arabicContent?: string;
  transliteration?: string;
  audioId?: string;
  imageUrl?: string;
}

/** [ASUMSI] Butir GET /admin/audio (minimal, dipakai lagi di A5). */
export interface AudioAsset {
  id: string;
  kind: string;
  originalName: string;
  durationMs: number;
  status: string;
}
