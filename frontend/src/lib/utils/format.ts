/**
 * [REKOMENDASI] Waktu format Indonesia, mis. "2 Sep 2026, 15.31".
 * timeZone dapat diatur (dipakai test); bawaannya zona waktu perangkat.
 */
export function formatDateTime(iso: string, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('day')} ${part('month')} ${part('year')}, ${part('hour')}.${part('minute')}`;
}

/**
 * Tanggal kalender YYYY-MM-DD menurut zona waktu perangkat (bukan UTC), mis. untuk nama berkas
 * laporan SDD 5.13. toISOString memakai UTC sehingga sebelum pukul 07.00 WIB tanggalnya mundur sehari.
 * timeZone dapat diatur (dipakai test); bawaannya zona waktu perangkat.
 */
export function formatDateStamp(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** [REKOMENDASI] Tanggal saja format Indonesia, mis. "2 Sep 2026". timeZone dapat diatur (dipakai test). */
export function formatDate(iso: string, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('day')} ${part('month')} ${part('year')}`;
}
