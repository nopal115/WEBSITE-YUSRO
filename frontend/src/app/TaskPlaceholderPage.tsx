import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';

// [TBD] Halaman Dengar-Pilih (/tugas/:taskId/pilih) dan Dengar-Tirukan (/tugas/:taskId/tirukan)
// dibangun pada tugas berikutnya (SDD 12.5). Layar penuh di luar AppLayout.
export function TaskPlaceholderPage({ title }: { title: string }): JSX.Element {
  const navigate = useNavigate();
  const goBack = (): void => {
    const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (historyIndex > 0) navigate(-1);
    else navigate('/belajar');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-neutral-surface-alt px-6 text-center">
      <h1 className="text-h2 text-text-primary">{title}</h1>
      <p className="text-body text-text-secondary">Halaman tugas ini belum tersedia.</p>
      <Button variant="outline" onClick={goBack}>
        KEMBALI
      </Button>
    </div>
  );
}
