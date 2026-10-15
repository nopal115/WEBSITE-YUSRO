import { formatDateStamp } from './format';

/** Menyimpan Blob sebagai berkas lewat tautan sementara (dipakai unduh laporan PDF). */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Nama berkas laporan: dari Content-Disposition bila ada; cadangan mengikuti pola SDD 5.13
 * (Laporan-<ID Santri>-<YYYY-MM-DD>.pdf) dengan tanggal lokal perangkat.
 */
export function reportFileName(fromHeader: string | null, studentCode: string): string {
  return fromHeader ?? `Laporan-${studentCode}-${formatDateStamp(new Date())}.pdf`;
}
