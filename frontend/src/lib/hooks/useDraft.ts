import { useState } from 'react';

/**
 * Isian lokal yang mengikuti nilai dari luar (mis. URL query) bila nilai itu berubah, misalnya
 * karena tombol Back, tetapi boleh berbeda selama pengguna masih mengetik atau isiannya belum valid.
 */
export function useDraft(value: string): [string, (next: string) => void] {
  const [draft, setDraft] = useState(value);
  const [source, setSource] = useState(value);
  if (value !== source) {
    setSource(value);
    setDraft(value);
  }
  return [draft, setDraft];
}
