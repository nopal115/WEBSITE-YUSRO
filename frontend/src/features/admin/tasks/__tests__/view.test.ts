import { describe, expect, it } from 'vitest';
import { completenessText, statusRequest, validateQuestion } from '../view';

const option = (label: string, isCorrect = false) => ({ label, arabicLabel: '', isCorrect });

describe('statusRequest', () => {
  it('mengaktifkan selalu lewat publish agar kelengkapan diperiksa (SDD 5.17)', () => {
    expect(statusRequest('activate')).toEqual({ kind: 'publish' });
    expect(statusRequest('reactivate')).toEqual({ kind: 'publish' });
  });

  it('nonaktifkan dan kembalikan ke draf lewat PATCH status; hapus lewat DELETE', () => {
    expect(statusRequest('deactivate')).toEqual({ kind: 'update', input: { status: 'INACTIVE' } });
    expect(statusRequest('toDraft')).toEqual({ kind: 'update', input: { status: 'DRAFT' } });
    expect(statusRequest('delete')).toEqual({ kind: 'delete' });
  });
});

describe('validateQuestion (SDD 5.17)', () => {
  it('menerima soal lengkap dengan tepat satu jawaban benar', () => {
    expect(validateQuestion({ prompt: 'Huruf apa?', audioId: 'aud-1', options: [option('Ba', true), option('Ta')] })).toBeNull();
  });

  it('menandai pertanyaan, audio, dan teks pilihan yang kosong', () => {
    const errors = validateQuestion({ prompt: ' ', audioId: '', options: [option('Ba', true), option('')] });
    expect(errors).toMatchObject({ prompt: 'Pertanyaan wajib diisi.', audioId: 'Pilih audio soal.', optionLabels: { 1: 'Teks pilihan wajib diisi.' } });
  });

  it('menolak kurang dari dua pilihan dan jumlah jawaban benar selain satu', () => {
    expect(validateQuestion({ prompt: 'a', audioId: 'b', options: [option('Ba', true)] })?.options).toBe('Minimal 2 pilihan jawaban.');
    expect(validateQuestion({ prompt: 'a', audioId: 'b', options: [option('Ba'), option('Ta')] })?.options).toBe('Tandai tepat satu jawaban benar.');
    expect(validateQuestion({ prompt: 'a', audioId: 'b', options: [option('Ba', true), option('Ta', true)] })?.options).toBe('Tandai tepat satu jawaban benar.');
  });
});

describe('completenessText', () => {
  it('jumlah soal untuk Dengar-Pilih, status audio referensi untuk Dengar-Tirukan', () => {
    expect(completenessText({ type: 'QUIZ', questionCount: 5, referenceAudio: null, isComplete: true })).toBe('5 soal');
    expect(completenessText({ type: 'IMITATION', questionCount: null, referenceAudio: null, isComplete: false })).toBe('Audio referensi belum dipilih');
  });
});
