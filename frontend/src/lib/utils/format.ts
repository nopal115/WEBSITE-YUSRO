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
