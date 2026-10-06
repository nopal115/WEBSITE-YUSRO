import { describe, expect, it } from 'vitest';
import { fromServer, isDirty, moveBlock, newBlock, serverErrors, toInput, validateBlocks } from '../blocks';
import type { AdminBlock } from '../types';

const server: AdminBlock[] = [
  { id: 'b1', type: 'TEXT', orderIndex: 1, textContent: 'Penjelasan', arabicContent: null, transliteration: null, imageUrl: null, audioId: null, audio: null },
  { id: 'b2', type: 'IMAGE', orderIndex: 2, textContent: null, arabicContent: null, transliteration: null, imageUrl: 'data:image/svg+xml;utf8,x', audioId: null, audio: null },
  { id: 'b3', type: 'AUDIO', orderIndex: 3, textContent: null, arabicContent: null, transliteration: null, imageUrl: null, audioId: 'aud-1', audio: { id: 'aud-1', originalName: 'a.wav', durationMs: 2000 } },
];

describe('toInput', () => {
  it('urutan = urutan larik; gambar dikirim apa adanya; teks kosong tidak dikirim', () => {
    expect(toInput(fromServer(server))).toEqual([
      { id: 'b1', type: 'TEXT', textContent: 'Penjelasan', arabicContent: undefined, transliteration: undefined },
      { id: 'b2', type: 'IMAGE', imageUrl: 'data:image/svg+xml;utf8,x' },
      { id: 'b3', type: 'AUDIO', audioId: 'aud-1' },
    ]);
    const added = { ...newBlock('TEXT'), arabicContent: '  بَ  ', transliteration: ' ba ' };
    expect(toInput([added])).toEqual([{ type: 'TEXT', textContent: undefined, arabicContent: 'بَ', transliteration: 'ba' }]);
  });
});

describe('validateBlocks (chk_material_blocks_payload)', () => {
  it('TEXT butuh teks atau teks Arab; AUDIO butuh audio; transliterasi maks 255', () => {
    const empty = newBlock('TEXT');
    const audio = newBlock('AUDIO');
    const long = { ...newBlock('TEXT'), arabicContent: 'بَ', transliteration: 'a'.repeat(256) };
    expect(validateBlocks([empty, audio, long])).toEqual({
      [empty.key]: { textContent: 'Isi teks atau teks Arab.' },
      [audio.key]: { audioId: 'Pilih audio pembelajaran.' },
      [long.key]: { transliteration: 'Maksimal 255 karakter.' },
    });
    expect(validateBlocks(fromServer(server))).toEqual({});
  });
});

describe('serverErrors', () => {
  it('memetakan blocks.N.field ke blok ke-N', () => {
    const blocks = fromServer(server);
    expect(serverErrors([{ field: 'blocks.2.audioId', message: 'Pilih audio pembelajaran.' }, { field: 'judul', message: 'x' }], blocks)).toEqual({ b3: { audioId: 'Pilih audio pembelajaran.' } });
  });
});

describe('isDirty / moveBlock', () => {
  it('urutan atau isi yang berubah terdeteksi; kembali ke semula tidak lagi berubah', () => {
    const blocks = fromServer(server);
    expect(isDirty(blocks, server)).toBe(false);
    const moved = moveBlock(blocks, 2, 0);
    expect(moved.map((b) => b.key)).toEqual(['b3', 'b1', 'b2']);
    expect(isDirty(moved, server)).toBe(true);
    expect(isDirty(moveBlock(moved, 0, 2), server)).toBe(false);
    expect(isDirty([{ ...blocks[0], textContent: 'Lain' }, ...blocks.slice(1)], server)).toBe(true);
    expect(moveBlock(blocks, 0, -1)).toBe(blocks);
  });
});
