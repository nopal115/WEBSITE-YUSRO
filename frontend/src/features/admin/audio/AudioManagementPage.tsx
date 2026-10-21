import { useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { OnDemandAudioPlayer } from '../../../components/audio/OnDemandAudioPlayer';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Pill } from '../../../components/ui/Pill';
import { SelectField } from '../../../components/ui/SelectField';
import { ApiError } from '../../../lib/api/ApiError';
import { EmptyState, ErrorState, ListSkeleton } from '../../learning/QueryStates';
import { useContentNotice } from '../content/useContentNotice';
import { adminAudioApi } from './api';
import { AudioUploadDialog } from './AudioUploadDialog';
import { AudioVersionsDialog } from './AudioVersionsDialog';
import { useAdminAudioList, useAudioMutations } from './hooks';
import type { AdminAudio, AudioFilter } from './types';
import { availableActions, formatDuration, formatSize, KIND_LABEL, parseFilter, STATUS_LABEL, STATUS_TONE } from './view';

type UploadState = { mode: 'create' } | { mode: 'replace'; audio: AdminAudio } | null;

const linkButton =
  'min-h-11 whitespace-nowrap rounded-md px-3 text-body text-brand-primary hover:bg-neutral-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:text-text-muted';

// Manajemen Audio (SDD 7.7.19, UI-ADMIN-AUDIO-01 sampai 03, FR-AUDIO-01 sampai 03).
// [REKOMENDASI] Tidak ada desain Figma untuk admin; tampilan mengikuti halaman Konten (A4).
export function AudioManagementPage(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const filter = parseFilter(params);
  const list = useAdminAudioList(filter);
  const mutations = useAudioMutations();
  const notice = useContentNotice();
  const [upload, setUpload] = useState<UploadState>(null);
  const [versionsOf, setVersionsOf] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<AdminAudio | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const setFilter = (patch: Partial<AudioFilter>) => {
    const next = { ...filter, ...patch };
    const search = new URLSearchParams();
    if (next.kind) search.set('kind', next.kind);
    if (next.status) search.set('status', next.status);
    setParams(search, { replace: true });
  };

  const closeUpload = useCallback((saved: boolean) => {
    setUpload(null);
    if (!saved) triggerRef.current?.focus();
  }, []);
  const closeVersions = useCallback(() => {
    setVersionsOf(null);
    triggerRef.current?.focus();
  }, []);
  const closeArchive = useCallback(() => {
    setArchiving(null);
    setArchiveError(null);
    triggerRef.current?.focus();
  }, []);

  const confirmArchive = () => {
    if (!archiving) return;
    const target = archiving;
    mutations.archive.mutate(target.id, {
      onSuccess: () => {
        notice.success(`"${target.originalName}" diarsipkan.`);
        setArchiving(null);
      },
      onError: (error) => setArchiveError(error instanceof ApiError ? error.message : 'Audio gagal diarsipkan. Silakan coba lagi.'),
    });
  };

  const busy = mutations.archive.isPending;
  let content: JSX.Element;
  if (list.isPending) {
    content = <ListSkeleton rows={4} />;
  } else if (list.isError) {
    content = <ErrorState error={list.error} onRetry={() => void list.refetch()} backTo="/admin" backLabel="Kembali ke dashboard" />;
  } else if (list.data.length === 0) {
    content = <EmptyState>{filter.kind || filter.status ? 'Tidak ada audio yang sesuai penyaring.' : 'Belum ada audio.'}</EmptyState>;
  } else {
    content = (
      <ul className="flex flex-col gap-4" aria-label="Daftar audio">
        {list.data.map((audio) => {
          const actions = availableActions(audio);
          return (
            <li key={audio.id} className="flex flex-col gap-2 rounded-lg border-2 border-neutral-border bg-neutral-surface p-5 shadow-card">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-body-s text-text-secondary">
                  {KIND_LABEL[audio.kind]} · versi {audio.version}
                </span>
                <Pill status={STATUS_TONE[audio.status]}>{STATUS_LABEL[audio.status]}</Pill>
                {audio.usedBySubmission && <Pill status="perhatian">DIPAKAI SUBMISSION</Pill>}
              </div>
              <p className="break-words text-h3 text-text-primary">{audio.originalName}</p>
              <p className="text-body-s text-text-secondary">
                {formatDuration(audio.durationMs)} · {formatSize(audio.sizeBytes)}
              </p>
              {audio.usage && (
                <p className="break-words text-body-s text-text-secondary">
                  Tugas: {audio.usage.taskTitle} ({audio.usage.materialTitle})
                </p>
              )}
              <OnDemandAudioPlayer fetchUrl={async () => (await adminAudioApi.getUrl(audio.id)).url} label={audio.originalName} buttonText="Putar" />
              <div className="-mx-3 flex flex-wrap items-center">
                {(audio.version > 1 || audio.kind === 'REFERENCE') && (
                  <button
                    type="button"
                    onClick={(event) => {
                      triggerRef.current = event.currentTarget;
                      setVersionsOf(audio.id);
                    }}
                    aria-label={`Riwayat versi: ${audio.originalName}`}
                    className={linkButton}
                  >
                    Riwayat versi
                  </button>
                )}
                {actions.includes('replace') && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(event) => {
                      triggerRef.current = event.currentTarget;
                      notice.clear();
                      setUpload({ mode: 'replace', audio });
                    }}
                    aria-label={`Ganti versi: ${audio.originalName}`}
                    className={linkButton}
                  >
                    Ganti Versi
                  </button>
                )}
                {actions.includes('archive') && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(event) => {
                      triggerRef.current = event.currentTarget;
                      notice.clear();
                      setArchiving(audio);
                    }}
                    aria-label={`Arsipkan: ${audio.originalName}`}
                    className={linkButton}
                  >
                    Arsipkan
                  </button>
                )}
              </div>
              {audio.usedBySubmission && audio.status === 'ACTIVE' && (
                <p className="text-body-s text-text-secondary">Audio ini sudah dipakai submission, sehingga hanya dapat diganti versinya.</p>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-6">
      <h1 className="sr-only">Manajemen Audio</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Jenis" value={filter.kind} onChange={(value) => setFilter({ kind: value as AudioFilter['kind'] })}>
          <option value="">Semua jenis</option>
          <option value="LEARNING">{KIND_LABEL.LEARNING}</option>
          <option value="REFERENCE">{KIND_LABEL.REFERENCE}</option>
        </SelectField>
        <SelectField label="Status" value={filter.status} onChange={(value) => setFilter({ status: value as AudioFilter['status'] })}>
          <option value="">Semua status</option>
          <option value="ACTIVE">Aktif</option>
          <option value="ARCHIVED">Arsip</option>
        </SelectField>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-s text-text-secondary" aria-live="polite">
          {list.data ? `${list.data.length} audio` : ''}
        </p>
        <Button
          onClick={(event) => {
            triggerRef.current = event.currentTarget;
            notice.clear();
            setUpload({ mode: 'create' });
          }}
        >
          UNGGAH AUDIO
        </Button>
      </div>
      {notice.element}
      {content}
      {upload && (
        <AudioUploadDialog
          replacing={upload.mode === 'replace' ? upload.audio : undefined}
          onSubmit={async ({ file, kind }) => {
            if (upload.mode === 'replace') {
              const created = await mutations.replace.mutateAsync({ id: upload.audio.id, file });
              notice.success(`Versi ${created.version} aktif. Versi lama diarsipkan.`);
            } else {
              const created = await mutations.upload.mutateAsync({ file, kind });
              notice.success(`"${created.originalName}" berhasil diunggah.`);
            }
          }}
          onClose={closeUpload}
        />
      )}
      {versionsOf && <AudioVersionsDialog audioId={versionsOf} onClose={closeVersions} />}
      {archiving && (
        <ConfirmDialog
          title="Arsipkan audio?"
          message={`"${archiving.originalName}" tidak dapat dipilih lagi untuk konten baru, tetapi tetap tersimpan untuk data historis.`}
          confirmLabel="ARSIPKAN"
          confirmVariant="primary"
          pending={mutations.archive.isPending}
          error={archiveError}
          onConfirm={confirmArchive}
          onClose={closeArchive}
        />
      )}
    </div>
  );
}
