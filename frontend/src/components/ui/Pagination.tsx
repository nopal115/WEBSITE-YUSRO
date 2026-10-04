import { Button } from './Button';

interface PaginationProps {
  page: number;
  totalPages: number;
  /** Jumlah seluruh data; bila diisi selalu ditampilkan (mis. daftar Santri, SDD 7.7.17). */
  total?: number;
  onChange: (page: number) => void;
  /** Nama navigasi untuk pembaca layar, mis. "Halaman riwayat". */
  label: string;
}

/** [REKOMENDASI] Navigasi halaman dari meta pagination SDD 5.5: SEBELUMNYA / Halaman X dari Y / BERIKUTNYA. */
export function Pagination({ page, totalPages, total, onChange, label }: PaginationProps): JSX.Element | null {
  const totalText = total === undefined ? null : `${total} data`;
  if (totalPages <= 1) return totalText ? <p className="text-body-s text-text-secondary">{totalText}</p> : null;
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label={label}>
      <Button variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        SEBELUMNYA
      </Button>
      <span className="text-body-s text-text-secondary">
        Halaman {page} dari {totalPages}
        {totalText && ` · ${totalText}`}
      </span>
      <Button variant="outline" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        BERIKUTNYA
      </Button>
    </nav>
  );
}
