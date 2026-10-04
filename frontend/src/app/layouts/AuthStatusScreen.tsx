import { Button } from '../../components/ui/Button';
import type { ApiError } from '../../lib/api/ApiError';

interface AuthStatusScreenProps {
  error?: ApiError | null;
  onRetry?: () => void;
}

/** Layar sementara selama status login belum diketahui, atau gagal dimuat. */
export function AuthStatusScreen({ error, onRetry }: AuthStatusScreenProps): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-surface-alt px-6">
      {error ? (
        <div className="flex max-w-[440px] flex-col items-center gap-5 text-center" role="alert">
          <p className="text-body-l text-text-primary">{error.message}</p>
          {onRetry && <Button onClick={onRetry}>COBA LAGI</Button>}
        </div>
      ) : (
        <p className="text-body text-text-secondary" role="status">Memuat…</p>
      )}
    </div>
  );
}
