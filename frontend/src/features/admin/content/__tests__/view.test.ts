import { describe, expect, it } from 'vitest';
import { ACTION_TARGET, availableActions, STATUS_LABEL } from '../view';

describe('availableActions (SDD 3.5.3, 7.7.18)', () => {
  it('DRAFT: aktifkan; hapus hanya bila belum dirujuk', () => {
    expect(availableActions('DRAFT', false)).toEqual(['activate', 'delete']);
    expect(availableActions('DRAFT', true)).toEqual(['activate']);
  });

  it('AKTIF: nonaktifkan; kembalikan ke draf hanya bila belum dirujuk; tidak pernah hapus', () => {
    expect(availableActions('ACTIVE', false)).toEqual(['deactivate', 'toDraft']);
    expect(availableActions('ACTIVE', true)).toEqual(['deactivate']);
  });

  it('NONAKTIF: hanya aktifkan kembali (tidak ke draf, tidak dihapus)', () => {
    expect(availableActions('INACTIVE', false)).toEqual(['reactivate']);
    expect(availableActions('INACTIVE', true)).toEqual(['reactivate']);
  });

  it('target status tiap aksi dan label lencana', () => {
    expect(ACTION_TARGET).toEqual({ activate: 'ACTIVE', deactivate: 'INACTIVE', reactivate: 'ACTIVE', toDraft: 'DRAFT' });
    expect(STATUS_LABEL).toEqual({ DRAFT: 'DRAFT', ACTIVE: 'AKTIF', INACTIVE: 'NONAKTIF' });
  });
});
