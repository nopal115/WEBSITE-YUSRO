import { Button } from '../components/ui/Button';
import { useAuth } from '../lib/hooks/useAuth';

// TODO(admin): [TBD] Halaman Admin/Pengajar belum dirancang. Ganti placeholder
// ini dengan dashboard admin setelah desain dan endpoint admin siap.
export function AdminPlaceholderPage(): JSX.Element {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-neutral-surface-alt px-6 text-center">
      <h1 className="text-h2 text-text-primary">Halaman Admin/Pengajar belum dibuat</h1>
      <p className="text-body text-text-secondary">Masuk sebagai {user?.name ?? 'Admin'}.</p>
      <Button variant="outline" onClick={() => void logout()}>KELUAR</Button>
    </div>
  );
}
