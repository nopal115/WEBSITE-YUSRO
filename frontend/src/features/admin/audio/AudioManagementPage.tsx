import { Archive, RefreshCw, Upload, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { OnDemandAudioPlayer } from '../../../components/audio/OnDemandAudioPlayer';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Pill } from '../../../components/ui/Pill';
import { SelectField } from '../../../components/ui/SelectField';
import { ApiError } from '../../../lib/api/ApiError';
import { EmptyState, ErrorState, ListSkeleton } from '../../learning/QueryStates';
import { useContentNotice } from '../content/useContentNotice';
import { adminAudioApi } from './api';
import { useAdminAudioList, useAudioMutations } from './hooks';
import type { AdminAudioItem, AudioKind } from './types';

function formatDuration(durationMs?: number): string {
  if (!durationMs) return '0 dtk';
  const seconds = Math.round(durationMs / 1000);
  const mins = Math.floor(seconds / 60);
  const remainingSecs = seconds % 60;
  if (mins > 0) {
    return `${mins}m ${remainingSecs}d`;
  }
  return `${seconds} dtk`;
}

export function AudioManagementPage(): JSX.Element {
  const [selectedKind, setSelectedKind] = useState('ALL');
  const notice = useContentNotice();

  // Upload modal state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadKind, setUploadKind] = useState<AudioKind>('LEARNING');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Replace modal state
  const [replacingItem, setReplacingItem] = useState<AdminAudioItem | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replaceError, setReplaceError] = useState<string | null>(null);

  // Archive modal state
  const [archivingItem, setArchivingItem] = useState<AdminAudioItem | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const audioQuery = useAdminAudioList(selectedKind);
  const mutations = useAudioMutations();

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Pilih berkas audio terlebih dahulu.');
      return;
    }
    setUploadError(null);
    mutations.upload.mutate(
      { file: uploadFile, kind: uploadKind },
      {
        onSuccess: () => {
          setUploadOpen(false);
          setUploadFile(null);
          notice.success('Berkas audio berhasil diunggah.');
        },
        onError: (err) => {
          setUploadError(err instanceof ApiError ? err.message : 'Gagal mengunggah audio.');
        },
      },
    );
  };

  const handleReplaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replacingItem || !replaceFile) {
      setReplaceError('Pilih berkas audio pengganti.');
      return;
    }
    setReplaceError(null);
    mutations.replace.mutate(
      { id: replacingItem.id, file: replaceFile },
      {
        onSuccess: () => {
          setReplacingItem(null);
          setReplaceFile(null);
          notice.success('Audio berhasil diganti dan versi baru aktif.');
        },
        onError: (err) => {
          setReplaceError(err instanceof ApiError ? err.message : 'Gagal mengganti audio.');
        },
      },
    );
  };

  const handleArchiveConfirm = () => {
    if (!archivingItem) return;
    setArchiveError(null);
    mutations.archive.mutate(archivingItem.id, {
      onSuccess: () => {
        setArchivingItem(null);
        notice.success('Audio berhasil diarsipkan.');
      },
      onError: (err) => {
        setArchiveError(err instanceof ApiError ? err.message : 'Gagal mengarsipkan audio.');
      },
    });
  };

  let listContent: JSX.Element;
  if (audioQuery.isPending) {
    listContent = <ListSkeleton rows={5} />;
  } else if (audioQuery.isError) {
    listContent = (
      <ErrorState
        error={audioQuery.error}
        onRetry={() => void audioQuery.refetch()}
        backTo="/admin"
        backLabel="Kembali ke dashboard"
      />
    );
  } else if (!audioQuery.data || audioQuery.data.length === 0) {
    listContent = <EmptyState>Belum ada audio dalam pustaka. Klik tombol di atas untuk mengunggah.</EmptyState>;
  } else {
    listContent = (
      <div className="overflow-x-auto rounded-lg border border-neutral-border bg-neutral-surface">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-border bg-neutral-surface-alt text-body-s font-semibold text-text-secondary">
              <th className="py-3 px-4">Nama Berkas</th>
              <th className="py-3 px-4">Jenis</th>
              <th className="py-3 px-4">Durasi</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Pratinjau</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-border text-body">
            {audioQuery.data.map((item) => (
              <tr key={item.id} className="hover:bg-neutral-surface-alt/40 transition">
                <td className="py-3 px-4 font-medium text-text-primary">
                  <div className="flex items-center gap-2">
                    <Volume2 size={18} className="shrink-0 text-brand-primary" aria-hidden="true" />
                    <span className="truncate max-w-[240px]" title={item.originalName}>
                      {item.originalName}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <Pill status={item.kind === 'REFERENCE' ? 'perhatian' : 'terbuka'}>
                    {item.kind === 'REFERENCE' ? 'Referensi' : item.kind === 'RECORDING' ? 'Rekaman' : 'Pembelajaran'}
                  </Pill>
                </td>
                <td className="py-3 px-4 text-text-secondary">{formatDuration(item.durationMs)}</td>
                <td className="py-3 px-4">
                  <Pill status={item.status === 'ACTIVE' ? 'selesai' : 'terkunci'}>
                    {item.status === 'ACTIVE' ? 'Aktif' : 'Diarsipkan'}
                  </Pill>
                </td>
                <td className="py-3 px-4">
                  {item.status === 'ACTIVE' ? (
                    <OnDemandAudioPlayer
                      fetchUrl={async () => (await adminAudioApi.getUrl(item.id)).url}
                      label={item.originalName}
                      buttonText="Putar"
                    />
                  ) : (
                    <span className="text-body-s text-text-muted italic">Tidak tersedia</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  {item.status === 'ACTIVE' && (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        className="!h-9 !px-3 text-body-s"
                        onClick={() => {
                          setReplacingItem(item);
                          setReplaceError(null);
                        }}
                        title="Ganti berkas audio"
                      >
                        <RefreshCw size={14} className="mr-1" /> Ganti
                      </Button>
                      <Button
                        variant="ghost"
                        className="!h-9 !px-3 text-body-s text-feedback-salah hover:bg-feedback-salah-soft"
                        onClick={() => {
                          setArchivingItem(item);
                          setArchiveError(null);
                        }}
                        title="Arsipkan audio"
                      >
                        <Archive size={14} className="mr-1" /> Arsip
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-6xl mx-auto">
      {notice.element}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold text-text-primary">Pustaka Audio</h1>
          <p className="text-body text-text-secondary">
            Kelola berkas audio materi pembelajaran dan audio referensi peniruan makhraj.
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload size={18} className="mr-2" /> Unggah Audio
        </Button>
      </div>

      <div className="w-full sm:w-64">
        <SelectField
          label="Filter Jenis Audio"
          value={selectedKind}
          onChange={(val) => setSelectedKind(val)}
        >
          <option value="ALL">Semua Jenis</option>
          <option value="LEARNING">Pembelajaran</option>
          <option value="REFERENCE">Referensi Imitasi</option>
        </SelectField>
      </div>

      {listContent}

      {/* Upload Modal */}
      {uploadOpen && (
        <dialog
          open
          className="fixed inset-0 z-50 flex items-center justify-center w-full h-full bg-text-primary/40 backdrop:bg-text-primary/40 p-4"
        >
          <div className="w-full max-w-md bg-neutral-surface rounded-lg shadow-raised p-6 flex flex-col gap-4">
            <h2 className="text-h2 font-bold text-text-primary">Unggah Berkas Audio</h2>
            <form onSubmit={handleUploadSubmit} className="flex flex-col gap-4">
              <SelectField
                label="Jenis Audio"
                value={uploadKind}
                onChange={(val) => setUploadKind(val as AudioKind)}
              >
                <option value="LEARNING">Audio Pembelajaran (Materi)</option>
                <option value="REFERENCE">Audio Referensi (Peniruan/Imitasi)</option>
              </SelectField>
              <div>
                <label className="block text-body-s font-medium text-text-primary mb-1">
                  Pilih Berkas Audio (.mp3, .wav, .m4a)
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-body file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-body-s file:font-semibold file:bg-brand-primary file:text-white hover:file:bg-brand-primary-hover"
                />
              </div>

              {uploadError && (
                <p className="rounded-md bg-feedback-salah-soft px-4 py-2 text-body-s text-feedback-salah">
                  {uploadError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setUploadOpen(false);
                    setUploadError(null);
                  }}
                  disabled={mutations.upload.isPending}
                >
                  Batal
                </Button>
                <Button type="submit" isLoading={mutations.upload.isPending}>
                  Unggah
                </Button>
              </div>
            </form>
          </div>
        </dialog>
      )}

      {/* Replace Modal */}
      {replacingItem && (
        <dialog
          open
          className="fixed inset-0 z-50 flex items-center justify-center w-full h-full bg-text-primary/40 backdrop:bg-text-primary/40 p-4"
        >
          <div className="w-full max-w-md bg-neutral-surface rounded-lg shadow-raised p-6 flex flex-col gap-4">
            <h2 className="text-h2 font-bold text-text-primary">Ganti Berkas Audio</h2>
            <p className="text-body text-text-secondary">
              Mengganti audio untuk <strong>{replacingItem.originalName}</strong>. Berkas lama akan otomatis
              diarsipkan secara aman dan versi baru akan diterbitkan.
            </p>
            <form onSubmit={handleReplaceSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-body-s font-medium text-text-primary mb-1">
                  Berkas Audio Baru (.mp3, .wav, .m4a)
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setReplaceFile(e.target.files?.[0] || null)}
                  className="w-full text-body file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-body-s file:font-semibold file:bg-brand-primary file:text-white hover:file:bg-brand-primary-hover"
                />
              </div>

              {replaceError && (
                <p className="rounded-md bg-feedback-salah-soft px-4 py-2 text-body-s text-feedback-salah">
                  {replaceError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setReplacingItem(null);
                    setReplaceError(null);
                  }}
                  disabled={mutations.replace.isPending}
                >
                  Batal
                </Button>
                <Button type="submit" isLoading={mutations.replace.isPending}>
                  Ganti & Terbitkan
                </Button>
              </div>
            </form>
          </div>
        </dialog>
      )}

      {/* Archive Confirmation Dialog */}
      {archivingItem && (
        <ConfirmDialog
          title="Arsipkan Audio?"
          message={`Apakah Anda yakin ingin mengarsipkan audio "${archivingItem.originalName}"? Audio ini tidak akan dapat diputar oleh santri baru, namun riwayat evaluasi yang menggunakan versi ini tetap terjaga.`}
          confirmLabel="ARSIPKAN"
          confirmVariant="salah"
          pending={mutations.archive.isPending}
          error={archiveError}
          onConfirm={handleArchiveConfirm}
          onClose={() => setArchivingItem(null)}
        />
      )}
    </div>
  );
}
