/** Kartu angka statistik (SDD 7.7.14, 7.7.16): label, nilai, dan catatan opsional. Tanpa Recharts. */
export function StatTile({ label, value, note }: { label: string; value: string; note?: string }): JSX.Element {
  return (
    <div className="rounded-md border border-neutral-border bg-neutral-surface p-4">
      <p className="text-label text-text-muted">{label}</p>
      <p className="mt-2 text-h1 text-brand-primary">{value}</p>
      {note && <p className="mt-1 text-body-s text-text-secondary">{note}</p>}
    </div>
  );
}
