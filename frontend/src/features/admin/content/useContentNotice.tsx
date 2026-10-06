import { useState } from 'react';
import { ApiError } from '../../../lib/api/ApiError';

export type Notice = { tone: 'success' | 'error'; text: string } | null;

/** Pemberitahuan hasil aksi di halaman konten: sukses (status) atau galat server (alert). */
export function useContentNotice() {
  const [notice, setNotice] = useState<Notice>(null);
  const success = (text: string) => setNotice({ tone: 'success', text });
  const failure = (error: unknown) => setNotice({ tone: 'error', text: error instanceof ApiError ? error.message : 'Data gagal disimpan. Silakan coba lagi.' });
  const element = notice ? (
    <p
      className={`rounded-md px-5 py-3 text-body-s ${notice.tone === 'success' ? 'bg-feedback-benar-soft text-feedback-benar' : 'bg-feedback-salah-soft text-feedback-salah'}`}
      role={notice.tone === 'success' ? 'status' : 'alert'}
    >
      {notice.text}
    </p>
  ) : null;
  return { element, success, failure, clear: () => setNotice(null) };
}
