import { Award, Download, Lock, LockOpen } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { saveBlob } from '../../lib/utils/download';
import { reportApi } from '../report/api';
import type { Progress, ProgressRatio } from './types';

function Companion({ label, ratio }: { label: string; ratio: ProgressRatio }): JSX.Element {
  return (
    <Card>
      <p className="text-label text-text-muted">{label}</p>
      <p className="mt-2 text-h1 text-brand-primary">{ratio.pct}%</p>
      <p className="mt-1 text-body-s text-text-secondary">
        {ratio.completed} dari {ratio.total}
      </p>
    </Card>
  );
}

/**
 * Progress Pembelajaran, rincian materi/tugas, dan progress per tahapan (SDD 7.7.12), dipakai
 * Progress Santri dan Detail Santri (Admin). afterSummary disisipkan setelah dua angka pendamping.
 */
export function ProgressSummary({ data, afterSummary }: { data: Progress; afterSummary?: ReactNode }): JSX.Element {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownloadCertificate = async (stageId: string, stageTitle: string) => {
    try {
      setDownloadingId(stageId);
      const { blob, filename } = await reportApi.downloadCertificate(stageId);
      saveBlob(blob, filename ?? `Syahadah-${stageTitle.replace(/\s+/g, '_')}.pdf`);
    } catch {
      alert('Gagal mengunduh syahadah. Silakan coba beberapa saat lagi.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <>
      {/* Tiga ukuran progress selalu berlabel; materi dan tugas hanya rincian (BR-PROGRESS-01/02). */}
      <Card>
        <p className="text-label text-text-muted">PROGRESS PEMBELAJARAN</p>
        <p className="mt-2 text-score text-brand-primary">{data.learningProgressPct}%</p>
        <ProgressBar className="mt-4" value={data.learningProgressPct} max={100} />
      </Card>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Companion label="PROGRESS MATERI" ratio={data.materials} />
        <Companion label="PROGRESS TUGAS" ratio={data.tasks} />
      </div>

      {afterSummary}

      <section aria-labelledby="progress-tahapan" className="flex flex-col gap-3">
        <h2 id="progress-tahapan" className="text-h3">
          Progress per tahapan
        </h2>
        <ul className="flex flex-col gap-3">
          {data.stages.map((stage) => {
            const locked = stage.access === 'LOCKED';
            const Icon = locked ? Lock : LockOpen;
            const completed = stage.pct === 100;

            return (
              <li key={stage.id} className="rounded-md border border-neutral-border bg-neutral-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-body font-semibold text-text-primary">{stage.title}</p>
                  <span className={`flex shrink-0 items-center gap-1 text-label ${locked ? 'text-text-secondary' : 'text-brand-primary'}`}>
                    <Icon size={16} aria-hidden="true" />
                    {locked ? 'Terkunci' : completed ? 'Selesai' : 'Terbuka'}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <ProgressBar className="flex-1" value={stage.pct} max={100} />
                  <span className="w-12 text-right text-body-s text-text-secondary">{stage.pct}%</span>
                </div>

                {/* Tombol Unduh Syahadah jika Tahapan telah 100% tuntas */}
                {completed && (
                  <div className="mt-3 flex items-center justify-between border-t border-neutral-border pt-3">
                    <span className="flex items-center gap-1.5 text-caption font-bold text-brand-primary">
                      <Award size={16} className="text-brand-accent" aria-hidden="true" />
                      Tahapan Tuntas
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDownloadCertificate(stage.id, stage.title)}
                      disabled={downloadingId === stage.id}
                      className="flex items-center gap-1.5 rounded-md border border-brand-primary bg-brand-primary/10 px-3 py-1.5 text-caption font-bold text-brand-primary hover:bg-brand-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary transition-colors disabled:opacity-50"
                    >
                      <Download size={14} aria-hidden="true" />
                      {downloadingId === stage.id ? 'Mengunduh…' : 'Unduh Syahadah'}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
