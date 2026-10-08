import type { AdminBlock, BlockInput, BlockType } from './types';

/** Blok di penyunting (belum disimpan). key stabil untuk React dan pemetaan galat. */
export interface DraftBlock {
  key: string;
  id?: string;
  type: BlockType;
  textContent: string;
  arabicContent: string;
  transliteration: string;
  audioId: string;
  imageUrl: string;
}

export type BlockErrors = Record<string, Partial<Record<'textContent' | 'arabicContent' | 'transliteration' | 'audioId' | 'imageUrl' | 'type', string>>>;

/** SDD 4.5.7: transliteration VARCHAR(255). */
export const TRANSLITERATION_MAX = 255;

let counter = 0;
const nextKey = () => `draf-${(counter += 1)}`;

export function fromServer(blocks: AdminBlock[]): DraftBlock[] {
  return blocks.map((block) => ({
    key: block.id,
    id: block.id,
    type: block.type,
    textContent: block.textContent ?? '',
    arabicContent: block.arabicContent ?? '',
    transliteration: block.transliteration ?? '',
    audioId: block.audioId ?? '',
    imageUrl: block.imageUrl ?? '',
  }));
}

export function newBlock(type: 'TEXT' | 'AUDIO'): DraftBlock {
  return { key: nextKey(), type, textContent: '', arabicContent: '', transliteration: '', audioId: '', imageUrl: '' };
}

/**
 * Body PUT /admin/materials/:id/blocks; urutan = urutan larik. Blok IMAGE dikirim apa adanya (id + imageUrl)
 * agar tidak terhapus diam-diam, karena gambar belum bisa ditambah atau diubah ([TBD] tanpa endpoint unggah).
 */
export function toInput(blocks: DraftBlock[]): BlockInput[] {
  return blocks.map((block) => {
    const base = block.id ? { id: block.id } : {};
    const text = (value: string) => (value.trim() === '' ? undefined : value.trim());
    if (block.type === 'IMAGE') return { ...base, type: 'IMAGE', imageUrl: block.imageUrl };
    if (block.type === 'AUDIO') return { ...base, type: 'AUDIO', audioId: text(block.audioId) };
    return { ...base, type: 'TEXT', textContent: text(block.textContent), arabicContent: text(block.arabicContent), transliteration: text(block.transliteration) };
  });
}

/** Validasi sesuai chk_material_blocks_payload (SDD 4.5.7): TEXT butuh teks atau teks Arab, AUDIO butuh audio. */
export function validateBlocks(blocks: DraftBlock[]): BlockErrors {
  const errors: BlockErrors = {};
  for (const block of blocks) {
    const own: BlockErrors[string] = {};
    if (block.type === 'TEXT') {
      if (!block.textContent.trim() && !block.arabicContent.trim()) own.textContent = 'Isi teks atau teks Arab.';
      if (block.transliteration.trim().length > TRANSLITERATION_MAX) own.transliteration = `Maksimal ${TRANSLITERATION_MAX} karakter.`;
    }
    if (block.type === 'AUDIO' && !block.audioId) own.audioId = 'Pilih audio pembelajaran.';
    if (Object.keys(own).length) errors[block.key] = own;
  }
  return errors;
}

/** Galat server errors[] berbentuk field "blocks.N.nama" dipetakan ke key blok ke-N. */
export function serverErrors(details: unknown, blocks: DraftBlock[]): BlockErrors {
  const errors: BlockErrors = {};
  if (!Array.isArray(details)) return errors;
  for (const item of details as { field?: string; message?: string }[]) {
    const match = /^blocks\.(\d+)\.(\w+)$/.exec(item.field ?? '');
    const block = match ? blocks[Number(match[1])] : undefined;
    if (!match || !block || !item.message) continue;
    errors[block.key] = { ...errors[block.key], [match[2]]: item.message };
  }
  return errors;
}

/** Ada perubahan dibanding data server (isi atau urutan). */
export function isDirty(blocks: DraftBlock[], server: AdminBlock[]): boolean {
  return JSON.stringify(toInput(blocks)) !== JSON.stringify(toInput(fromServer(server)));
}

export function moveBlock(blocks: DraftBlock[], from: number, to: number): DraftBlock[] {
  if (to < 0 || to >= blocks.length || from === to) return blocks;
  const next = [...blocks];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export const BLOCK_LABEL: Record<BlockType, string> = { TEXT: 'Teks', AUDIO: 'Audio', IMAGE: 'Gambar' };
