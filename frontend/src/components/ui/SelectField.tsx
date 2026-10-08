import { useId, type ReactNode } from 'react';

/** Pilihan bergaya TextField (label di dalam kotak). Dipakai filter daftar Admin. */
export function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }): JSX.Element {
  const id = useId();
  return (
    <label htmlFor={id} className="flex flex-col gap-1 rounded-sm border-2 border-neutral-border-strong bg-neutral-surface px-5 py-3 focus-within:border-brand-primary">
      <span id={`${id}-label`} className="text-body-s text-text-muted">
        {label}
      </span>
      {/* aria-labelledby: nama kontrol hanya teks label, tanpa teks opsi yang terpilih. */}
      <select id={id} aria-labelledby={`${id}-label`} value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-transparent text-body-l text-text-primary outline-none">
        {children}
      </select>
    </label>
  );
}
