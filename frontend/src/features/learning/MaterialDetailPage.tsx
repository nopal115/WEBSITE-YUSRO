import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AudioPlayer } from '../../components/audio/AudioPlayer';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ApiError } from '../../lib/api/ApiError';
import { useCompleteMaterial, useMaterial, useStages } from './hooks';
import { ErrorState } from './QueryStates';
import { completionState } from './status';
import type { MaterialBlock, MaterialDetail, MaterialTask } from './types';

const TASK_TYPE_LABEL = { QUIZ: 'Dengar-Pilih', IMITATION: 'Dengar-Tirukan' } as const;
const TASK_PATH = { QUIZ: 'pilih', IMITATION: 'tirukan' } as const;
const TASK_STATUS_LABEL = { AVAILABLE: 'Belum dikerjakan', COMPLETED: 'Selesai', LOCKED: 'Terkunci' } as const;

function Block({ block, onAudioExpired }: { block: MaterialBlock; onAudioExpired: () => Promise<unknown> }): JSX.Element {
  if (block.type === 'AUDIO') return <AudioPlayer src={block.audioUrl} label="audio materi" onExpired={onAudioExpired} />;
  if (block.type === 'IMAGE') {
    // [TBD] Kontrak belum punya teks alternatif gambar; perlu field tambahan dari backend.
    return <img src={block.imageUrl} alt="Gambar materi" loading="lazy" className="w-full rounded-md" />;
  }
  if (block.arabicContent) {
    // SDD 7.4.1: Arab L untuk teks pada blok materi; besar dan terpusat (SDD 7.7.7).
    return (
      <div className="text-center">
        <p className="font-arabic text-arabic-l text-text-primary" lang="ar" dir="rtl">
          {block.arabicContent}
        </p>
        {block.transliteration && <p className="text-body text-text-secondary">{block.transliteration}</p>}
      </div>
    );
  }
  return <p className="text-body-l text-text-primary">{block.textContent}</p>;
}

function TaskItem({ task }: { task: MaterialTask }): JSX.Element {
  return (
    <li>
      <Link
        to={`/tugas/${task.id}/${TASK_PATH[task.type]}`}
        className="flex min-h-11 items-center justify-between gap-4 rounded-md border border-neutral-border bg-neutral-surface p-4 hover:bg-neutral-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
      >
        <div className="min-w-0">
          <p className="text-h3 text-text-primary">{task.title}</p>
          <p className="text-body-s text-text-secondary">
            {TASK_TYPE_LABEL[task.type]} · {TASK_STATUS_LABEL[task.status]} · Nilai terbaik {task.bestScore ?? '—'} · Percobaan {task.attemptCount}
          </p>
        </div>
        <ChevronRight size={20} className="shrink-0 text-brand-primary" aria-hidden="true" />
      </Link>
    </li>
  );
}

function MaterialContent({ material, onAudioExpired }: { material: MaterialDetail; onAudioExpired: () => Promise<unknown> }): JSX.Element {
  const navigate = useNavigate();
  const complete = useCompleteMaterial();
  const [reachedEnd, setReachedEnd] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const unlocked = complete.data?.stageUnlocked ?? null;
  const stages = useStages(unlocked !== null);
  const unlockedOrder = stages.data?.find((stage) => stage.id === unlocked?.id)?.orderIndex;

  // Akhir konten tercapai saat penanda di bawah blok terakhir terlihat; konten yang lebih
  // pendek dari layar langsung terlihat sehingga tombol langsung aktif. Sekali aktif tetap aktif.
  useEffect(() => {
    const marker = endRef.current;
    if (!marker || reachedEnd) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setReachedEnd(true);
    });
    observer.observe(marker);
    return () => observer.disconnect();
  }, [reachedEnd]);

  const state = completionState(material.status, reachedEnd);
  const blocks = [...material.blocks].sort((a, b) => a.orderIndex - b.orderIndex);
  const { previousMaterialId, nextMaterialId, nextMaterialLocked } = material.navigation;

  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-6">
      <h1 className="text-h2 text-text-primary">{material.title}</h1>

      <Card className="flex flex-col gap-6">
        {blocks.map((block) => (
          <Block key={block.orderIndex} block={block} onAudioExpired={onAudioExpired} />
        ))}
        <div ref={endRef} aria-hidden="true" />
      </Card>

      {material.tasks.length > 0 && (
        <section aria-labelledby="tugas-materi" className="flex flex-col gap-3">
          <h2 id="tugas-materi" className="text-h3 text-text-primary">
            Tugas
          </h2>
          <ul className="flex flex-col gap-3">
            {material.tasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </ul>
        </section>
      )}

      {unlocked && (
        // Peristiwa tahapan baru terbuka dibuat terlihat (SDD 5.8, kalimat SDD 7.9).
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-feedback-benar-soft px-5 py-4 text-feedback-benar" role="status">
          <p className="text-body font-semibold">{unlockedOrder ? `Tahapan ${unlockedOrder} telah terbuka.` : `Tahapan “${unlocked.title}” telah terbuka.`}</p>
          <Link to={`/belajar/${unlocked.id}`} className="text-h3 underline">
            Buka tahapan
          </Link>
        </div>
      )}

      {state === 'done' ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-h3 text-feedback-benar">
            <CheckCircle2 size={24} aria-hidden="true" />
            Selesai
          </p>
          {nextMaterialId && !nextMaterialLocked && (
            <Button onClick={() => navigate(`/materi/${nextMaterialId}`)}>MATERI BERIKUTNYA</Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {complete.isError && (
            <p className="rounded-md bg-feedback-salah-soft px-5 py-3 text-body-s text-feedback-salah" role="alert">
              {complete.error instanceof ApiError ? complete.error.message : 'Terjadi kesalahan. Coba lagi.'}
            </p>
          )}
          <Button
            className="w-full"
            disabled={state === 'blocked'}
            isLoading={complete.isPending}
            loadingText="MENYIMPAN…"
            onClick={() => complete.mutate(material.id)}
            aria-describedby={state === 'blocked' ? 'petunjuk-selesai' : undefined}
          >
            SELESAIKAN MATERI
          </Button>
          {state === 'blocked' && (
            <p id="petunjuk-selesai" className="text-center text-body-s text-text-secondary">
              Pelajari materi sampai akhir untuk menyelesaikannya.
            </p>
          )}
        </div>
      )}

      <nav className="flex flex-col gap-2" aria-label="Navigasi materi">
        <div className="flex items-center justify-between gap-4">
          {previousMaterialId ? (
            <Link to={`/materi/${previousMaterialId}`} className="flex min-h-11 items-center gap-1 text-body text-brand-primary hover:underline">
              <ChevronLeft size={20} aria-hidden="true" />
              Sebelumnya
            </Link>
          ) : (
            <span />
          )}
          {nextMaterialId && !nextMaterialLocked ? (
            <Link to={`/materi/${nextMaterialId}`} className="flex min-h-11 items-center gap-1 text-body text-brand-primary hover:underline">
              Selanjutnya
              <ChevronRight size={20} aria-hidden="true" />
            </Link>
          ) : (
            <span className="flex min-h-11 items-center gap-1 text-body text-text-muted" aria-disabled="true">
              Selanjutnya
              <ChevronRight size={20} aria-hidden="true" />
            </span>
          )}
        </div>
        {nextMaterialId && nextMaterialLocked && (
          <p className="text-right text-body-s text-text-secondary">Selesaikan materi ini untuk membuka materi berikutnya.</p>
        )}
      </nav>
    </div>
  );
}

function DetailSkeleton(): JSX.Element {
  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-6" aria-busy="true" aria-label="Memuat">
      <div className="h-8 w-1/2 animate-pulse rounded-sm bg-neutral-border motion-reduce:animate-none" />
      <Card>
        <div className="animate-pulse space-y-6 motion-reduce:animate-none">
          <div className="h-5 w-full rounded-sm bg-neutral-border" />
          <div className="mx-auto h-24 w-2/3 rounded-md bg-neutral-border" />
          <div className="h-20 w-full rounded-md bg-neutral-border" />
        </div>
      </Card>
    </div>
  );
}

// SDD 7.7.7 (UI-LEARN-03). [REKOMENDASI] Tampilan disusun dari SDD dan UI kit; dicocokkan dengan Figma nanti.
export function MaterialDetailPage(): JSX.Element {
  const materialId = useParams().materialId ?? '';
  const { data, isPending, isError, error, refetch } = useMaterial(materialId);

  if (isPending) return <DetailSkeleton />;
  if (isError) {
    return (
      <div className="mx-auto max-w-[1040px]">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }
  // key: keadaan halaman (akhir konten, hasil penyelesaian) dimulai ulang untuk setiap materi.
  return <MaterialContent key={materialId} material={data} onAudioExpired={() => refetch()} />;
}
