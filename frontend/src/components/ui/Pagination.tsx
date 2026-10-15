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
    // Layar < 640 px: teks halaman di baris sendiri, dua tombol berdampingan; lebih lebar: satu baris.
    <nav className="grid grid-cols-2 gap-3 sm:flex sm:items-center sm:justify-between" aria-label={label}>
      <Button variant="outline" className="w-full max-sm:px-4 sm:w-auto" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        SEBELUMNYA
      </Button>
      <span className="order-first col-span-2 text-center text-body-s text-text-secondary sm:order-none">
        Halaman {page} dari {totalPages}
        {totalText && ` · ${totalText}`}
      </span>
      <Button variant="outline" className="w-full max-sm:px-4 sm:w-auto" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        BERIKUTNYA
      </Button>
    </nav>
  );
}
