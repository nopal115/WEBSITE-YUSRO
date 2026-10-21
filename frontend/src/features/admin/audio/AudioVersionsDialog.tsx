import { useEffect, useId, useRef } from 'react';
import { OnDemandAudioPlayer } from '../../../components/audio/OnDemandAudioPlayer';
import { Button } from '../../../components/ui/Button';
import { Pill } from '../../../components/ui/Pill';
import { formatDateTime } from '../../../lib/utils/format';
import { ErrorState, ListSkeleton } from '../../learning/QueryStates';
import { adminAudioApi } from './api';
import { useAdminAudioDetail } from './hooks';
import { formatDuration, STATUS_LABEL, STATUS_TONE } from './view';

/** Riwayat versi audio (SDD 7.7.19): versi mana yang berlaku pada periode mana. */
export function AudioVersionsDialog({ audioId, onClose }: { audioId: string; onClose: () => void }): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const detail = useAdminAudioDetail(audioId);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    dialog?.addEventListener('close', onClose);
    return () => dialog?.removeEventListener('close', onClose);
  }, [onClose]);

  const versions = detail.data?.versions ?? [];

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} className="w-[calc(100%-2rem)] max-w-[640px] rounded-lg border-0 bg-neutral-surface p-0 text-text-primary shadow-raised backdrop:bg-text-primary/40">
      <div className="flex flex-col gap-5 p-6">
        <h2 id={titleId} className="text-h2">
          Riwayat versi
        </h2>
        {detail.isPending ? (
          <ListSkeleton rows={2} />
        ) : detail.isError ? (
          <ErrorState error={detail.error} onRetry={() => void detail.refetch()} backTo="/admin/audio" backLabel="Kembali ke daftar audio" />
        ) : (
          <ol className="flex flex-col gap-4" aria-label="Versi audio, terbaru dulu">
            {versions.map((version, index) => {
              // Versi berlaku sejak diunggah sampai versi berikutnya (yang lebih baru) diunggah.
              const until = index > 0 ? versions[index - 1].createdAt : null;
              return (
                <li key={version.id} className="flex flex-col gap-2 rounded-md border border-neutral-border p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-body font-semibold">Versi {version.version}</span>
                    <Pill status={STATUS_TONE[version.status]}>{STATUS_LABEL[version.status]}</Pill>
                    {version.usedBySubmission && <Pill status="perhatian">DIPAKAI SUBMISSION</Pill>}
                  </div>
                  <p className="break-words text-body-s text-text-secondary">
                    {version.originalName} · {formatDuration(version.durationMs)}
                  </p>
                  <p className="text-body-s text-text-secondary">
                    Berlaku {formatDateTime(version.createdAt)} – {until ? formatDateTime(until) : 'sekarang'}
                  </p>
                  <OnDemandAudioPlayer fetchUrl={async () => (await adminAudioApi.getUrl(version.id)).url} label={`versi ${version.version} ${version.originalName}`} buttonText="Putar" />
                </li>
              );
            })}
          </ol>
        )}
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => dialogRef.current?.close()}>
            TUTUP
          </Button>
        </div>
      </div>
    </dialog>
  );
}
