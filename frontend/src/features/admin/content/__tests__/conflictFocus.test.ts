import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../lib/api/ApiError';
import { focusAfterConflict, isContentInUse } from '../conflictFocus';

const focusable = (disabled = false) => ({ focus: vi.fn(), disabled });

describe('isContentInUse', () => {
  it('hanya 409 CONTENT_IN_USE', () => {
    expect(isContentInUse(new ApiError({ status: 409, code: 'CONTENT_IN_USE', message: 'x' }))).toBe(true);
    expect(isContentInUse(new ApiError({ status: 409, code: 'CONTENT_INVALID_TRANSITION', message: 'x' }))).toBe(false);
    expect(isContentInUse(new ApiError({ status: 500, message: 'x' }))).toBe(false);
    expect(isContentInUse(new Error('x'))).toBe(false);
  });
});

describe('focusAfterConflict', () => {
  it('fokus ke tombol Ubah baris yang sama', () => {
    const edit = focusable();
    const heading = focusable();
    const find = vi.fn(() => edit);
    focusAfterConflict(find, 'stg-1', heading);
    expect(find).toHaveBeenCalledWith('stg-1');
    expect(edit.focus).toHaveBeenCalledOnce();
    expect(heading.focus).not.toHaveBeenCalled();
  });

  it('baris sudah tidak ada atau tombol nonaktif → fokus ke judul halaman', () => {
    const heading = focusable();
    focusAfterConflict(() => null, 'stg-1', heading);
    expect(heading.focus).toHaveBeenCalledOnce();
    const disabled = focusable(true);
    focusAfterConflict(() => disabled, 'stg-1', heading);
    expect(disabled.focus).not.toHaveBeenCalled();
    expect(heading.focus).toHaveBeenCalledTimes(2);
  });
});
