import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ApiError } from '../../lib/api/ApiError';

// Keadaan memuat, kosong, dan galat (SDD 7.8). [REKOMENDASI] Tampilan menunggu Figma.

/** Kerangka berbentuk kartu daftar, bukan pemutar di tengah layar (SDD 7.8). */
export function ListSkeleton({ rows = 4 }: { rows?: number }): JSX.Element {
  return (
    <ul className="flex flex-col gap-4" aria-busy="true" aria-label="Memuat">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index}>
          <Card>
            <div className="animate-pulse space-y-3 motion-reduce:animate-none">
              <div className="h-6 w-2/3 rounded-sm bg-neutral-border" />
              <div className="h-4 w-1/3 rounded-sm bg-neutral-border" />
              <div className="h-3 w-full rounded-full bg-neutral-border" />
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function EmptyState({ children }: { children: string }): JSX.Element {
  return (
    <Card>
      <p className="text-body text-text-secondary">{children}</p>
    </Card>
  );
}

/** Galat akses SDD 3.8.6 dan tugas tidak aktif (3.9.9, 3.10.8) tidak bisa dicoba ulang; galat lain diberi tombol COBA LAGI. */
const ACCESS_ERRORS = ['LEARNING_STAGE_LOCKED', 'LEARNING_MATERIAL_LOCKED', 'LEARNING_MATERIAL_INACTIVE', 'QUIZ_TASK_INACTIVE', 'TASK_INACTIVE'];

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }): JSX.Element {
  const message = error instanceof ApiError ? error.message : 'Terjadi kesalahan. Coba lagi.';
  const isAccessError = error instanceof ApiError && !!error.code && ACCESS_ERRORS.includes(error.code);
  return (
    <Card>
      <div className="flex flex-col items-start gap-4" role="alert">
        <p className="text-body-l text-text-primary">{message}</p>
        {isAccessError ? (
          <Link to="/belajar" className="text-h3 text-brand-primary hover:underline">
            Kembali ke daftar tahapan
          </Link>
        ) : (
          <Button onClick={onRetry}>COBA LAGI</Button>
        )}
      </div>
    </Card>
  );
}
