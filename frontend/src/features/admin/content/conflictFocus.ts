import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { ApiError } from '../../../lib/api/ApiError';

interface Focusable {
  focus(): void;
  disabled?: boolean;
}

/** 409 CONTENT_IN_USE: konten ternyata sudah dipakai sehingga tombol Hapus menjadi nonaktif setelah daftar dimuat ulang. */
export function isContentInUse(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409 && error.code === 'CONTENT_IN_USE';
}

/** Fokus ke tombol "Ubah" baris yang sama; bila baris sudah tidak ada (atau tombolnya nonaktif), ke judul halaman. */
export function focusAfterConflict(findEdit: (id: string) => Focusable | null, id: string, heading: Focusable | null): void {
  const edit = findEdit(id);
  if (edit && !edit.disabled) edit.focus();
  else heading?.focus();
}

/**
 * Menunda pemindahan fokus sampai daftar selesai dimuat ulang, karena tombol Hapus yang memicu dialog
 * dapat menjadi nonaktif dan fokus bawaan dialog jatuh ke body.
 */
export function useConflictFocus(isFetching: boolean, headingRef: RefObject<HTMLElement>): (id: string) => void {
  const pendingId = useRef<string | null>(null);
  const [request, setRequest] = useState(0);
  useEffect(() => {
    const id = pendingId.current;
    if (!id || isFetching) return;
    pendingId.current = null;
    focusAfterConflict((target) => document.querySelector<HTMLButtonElement>(`[data-reorder-id="${CSS.escape(target)}"] [data-edit]`), id, headingRef.current);
  }, [request, isFetching, headingRef]);
  return useCallback((id: string) => {
    pendingId.current = id;
    setRequest((count) => count + 1);
  }, []);
}
