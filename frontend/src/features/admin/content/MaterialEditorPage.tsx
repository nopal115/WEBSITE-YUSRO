import { ArrowLeft, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { Link, useBlocker, useParams } from 'react-router-dom';
import { OnDemandAudioPlayer } from '../../../components/audio/OnDemandAudioPlayer';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ReorderableList } from '../../../components/ui/ReorderableList';
import { SelectField } from '../../../components/ui/SelectField';
import { TextField } from '../../../components/ui/TextField';
import { ApiError } from '../../../lib/api/ApiError';
import { EmptyState, ErrorState, ListSkeleton } from '../../learning/QueryStates';
import { ExitConfirmDialog } from '../../quiz/ExitConfirmDialog';
import { adminContentApi } from './api';
import { BLOCK_LABEL, fromServer, isDirty, moveBlock, newBlock, serverErrors, toInput, TRANSLITERATION_MAX, validateBlocks, type BlockErrors, type DraftBlock } from './blocks';
import { ContentStatusPill } from './ContentStatusActions';
import { useAdminMaterial, useLearningAudio, useMaterialBlocks, useSaveBlocks } from './hooks';
import type { AdminBlock } from './types';
import { useContentNotice } from './useContentNotice';

function TextAreaField({ label, value, onChange, error, arabic = false, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; error?: string; arabic?: boolean; rows?: number }): JSX.Element {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={`flex flex-col gap-1 rounded-sm border-2 bg-neutral-surface px-5 py-3 ${error ? 'border-feedback-salah' : 'border-neutral-border-strong focus-within:border-brand-primary'}`}>
        <span className="text-body-s text-text-muted">{label}</span>
        <textarea
          id={id}
          value={value}
          rows={rows}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          // Teks Arab: font Arab, arah kanan-ke-kiri, lang ar (SDD 7.4.1).
          {...(arabic ? { dir: 'rtl', lang: 'ar' } : {})}
          className={`w-full resize-y bg-transparent p-0 text-text-primary outline-none ${arabic ? 'font-arabic text-arabic-s' : 'text-body'}`}
        />
      </label>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-body-s text-feedback-salah">
          {error}
        </p>
      )}
    </div>
  );
}

const snippet = (block: DraftBlock) => {
  const text = (block.textContent || block.arabicContent).trim();
  return text ? `${BLOCK_LABEL[block.type]}: ${text.slice(0, 24)}` : `Blok ${BLOCK_LABEL[block.type].toLowerCase()}`;
};

const LEAVE_MESSAGE = 'Perubahan konten belum disimpan dan akan hilang jika Anda keluar. Tetap tinggalkan halaman?';

/** Salinan lokal blok materi; disimpan sekaligus lewat PUT /admin/materials/:id/blocks (SDD 5.15). */
function BlockEditor({ materialId, server, notice, backRef }: { materialId: string; server: AdminBlock[]; notice: ReturnType<typeof useContentNotice>; backRef: RefObject<HTMLAnchorElement> }): JSX.Element {
  const [drafts, setDrafts] = useState<DraftBlock[]>(() => fromServer(server));
  const [errors, setErrors] = useState<BlockErrors>({});
  const save = useSaveBlocks(materialId);
  const audio = useLearningAudio();
  const focusKey = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dirty = isDirty(drafts, server);

  // Peringatan meninggalkan halaman dengan perubahan belum disimpan (pola A3/quiz: useBlocker + beforeunload).
  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (!dirty) return;
    const handle = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handle);
    return () => window.removeEventListener('beforeunload', handle);
  }, [dirty]);

  // Blok baru langsung difokuskan pada isian pertamanya.
  useEffect(() => {
    if (!focusKey.current || !listRef.current) return;
    const row = listRef.current.querySelector<HTMLElement>(`[data-reorder-id="${CSS.escape(focusKey.current)}"]`);
    focusKey.current = null;
    row?.querySelector<HTMLElement>('textarea, select')?.focus();
  }, [drafts]);

  const update = (key: string, patch: Partial<DraftBlock>) => {
    setDrafts((current) => current.map((block) => (block.key === key ? { ...block, ...patch } : block)));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };
  const add = (type: 'TEXT' | 'AUDIO') => {
    const block = newBlock(type);
    focusKey.current = block.key;
    setDrafts((current) => [...current, block]);
  };

  const submit = () => {
    notice.clear();
    const found = validateBlocks(drafts);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      notice.failureText('Konten belum lengkap. Periksa blok yang ditandai.');
      return;
    }
    save.mutate(toInput(drafts), {
      onSuccess: () => notice.success('Konten materi tersimpan.'),
      onError: (error) => {
        if (error instanceof ApiError) setErrors(serverErrors(error.details, drafts));
        notice.failure(error);
      },
    });
  };

  const cancel = () => {
    notice.clear();
    setDrafts(fromServer(server));
    setErrors({});
  };

  return (
    <div className="flex flex-col gap-6">
      {drafts.length === 0 ? (
        <EmptyState>Materi ini belum memiliki blok konten. Tambahkan blok teks atau audio.</EmptyState>
      ) : (
        <div ref={listRef}>
          <ReorderableList
            items={drafts}
            getId={(block) => block.key}
            getLabel={snippet}
            onMove={(from, to) => setDrafts((current) => moveBlock(current, from, to))}
            disabled={save.isPending}
            label="Blok konten materi"
            renderItem={(block, index) => {
              const own = errors[block.key] ?? {};
              return (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-label text-text-secondary">
                      BLOK {index + 1} · {BLOCK_LABEL[block.type].toUpperCase()}
                    </p>
                    <button
                      type="button"
                      onClick={() => setDrafts((current) => current.filter((item) => item.key !== block.key))}
                      disabled={save.isPending}
                      aria-label={`Hapus blok ${index + 1} (${BLOCK_LABEL[block.type].toLowerCase()})`}
                      className="flex min-h-11 items-center gap-1 rounded-md px-3 text-body-s text-feedback-salah hover:bg-neutral-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      Hapus blok
                    </button>
                  </div>
                  {block.type === 'TEXT' && (
                    <>
                      <TextAreaField label="Teks (opsional bila ada teks Arab)" value={block.textContent} onChange={(textContent) => update(block.key, { textContent })} error={own.textContent} />
                      <TextAreaField label="Teks Arab (opsional bila ada teks)" value={block.arabicContent} onChange={(arabicContent) => update(block.key, { arabicContent })} arabic rows={2} />
                      <TextField label="Transliterasi (opsional)" value={block.transliteration} maxLength={TRANSLITERATION_MAX} onChange={(event) => update(block.key, { transliteration: event.target.value })} error={own.transliteration} />
                    </>
                  )}
                  {block.type === 'AUDIO' && (
                    <>
                      <SelectField label="Audio pembelajaran" value={block.audioId} onChange={(audioId) => update(block.key, { audioId })}>
                        <option value="">{audio.isPending ? 'Memuat daftar audio…' : 'Pilih audio…'}</option>
                        {audio.data
                          ?.filter((item) => item.status === 'ACTIVE' || item.id === block.audioId)
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.originalName} ({Math.round(item.durationMs / 100) / 10} detik)
                            </option>
                          ))}
                      </SelectField>
                      {own.audioId && <p className="text-body-s text-feedback-salah">{own.audioId}</p>}
                      {audio.isError && <p className="text-body-s text-text-secondary">Daftar audio gagal dimuat.</p>}
                      {block.audioId && (
                        <OnDemandAudioPlayer
                          key={block.audioId}
                          fetchUrl={async () => (await adminContentApi.getAudioUrl(block.audioId)).url}
                          label={`pratinjau audio blok ${index + 1}`}
                          buttonText="Putar pratinjau"
                        />
                      )}
                    </>
                  )}
                  {block.type === 'IMAGE' && (
                    <>
                      <img src={block.imageUrl} alt={`Gambar blok ${index + 1}`} className="max-h-40 self-start rounded-md border border-neutral-border" />
                      {/* [TBD] SDD tidak punya endpoint unggah gambar: blok gambar tidak dapat ditambah atau diubah. */}
                      <p className="text-body-s text-text-secondary">Blok gambar belum dapat ditambah atau diubah. Blok ini tetap disimpan apa adanya.</p>
                    </>
                  )}
                </div>
              );
            }}
          />
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="outline" onClick={() => add('TEXT')} disabled={save.isPending}>
          TAMBAH BLOK TEKS
        </Button>
        <Button variant="outline" onClick={() => add('AUDIO')} disabled={save.isPending}>
          TAMBAH BLOK AUDIO
        </Button>
      </div>
      {dirty && (
        <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-md border border-brand-primary-line bg-brand-primary-soft p-4 shadow-raised sm:flex-row sm:items-center sm:justify-between" role="region" aria-label="Perubahan konten">
          <p className="text-body font-semibold text-brand-primary">Perubahan konten belum disimpan.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" onClick={cancel} disabled={save.isPending}>
              BATALKAN PERUBAHAN
            </Button>
            <Button onClick={submit} isLoading={save.isPending} loadingText="MENYIMPAN…">
              SIMPAN KONTEN
            </Button>
          </div>
        </div>
      )}
      <ExitConfirmDialog open={blocker.state === 'blocked'} onCancel={() => blocker.reset?.()} onConfirm={() => blocker.proceed?.()} returnFocusRef={backRef} title="Tinggalkan penyunting?" message={LEAVE_MESSAGE} />
    </div>
  );
}

// Penyunting konten materi (SDD 7.7.18, 5.15, FR-LEARN-03). [REKOMENDASI] Tidak ada desain Figma untuk admin.
export function MaterialEditorPage(): JSX.Element {
  const id = useParams().materialId ?? '';
  const material = useAdminMaterial(id);
  const blocks = useMaterialBlocks(id);
  const notice = useContentNotice();
  const backRef = useRef<HTMLAnchorElement>(null);
  const backTo = material.data ? `/admin/materi?stageId=${encodeURIComponent(material.data.stageId)}` : '/admin/materi';

  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-6">
      <Link ref={backRef} to={backTo} className="flex min-h-11 items-center gap-2 self-start text-body text-brand-primary hover:underline">
        <ArrowLeft size={20} aria-hidden="true" />
        Daftar materi
      </Link>
      {material.isPending || blocks.isPending ? (
        <ListSkeleton rows={3} />
      ) : material.isError || blocks.isError ? (
        <ErrorState error={material.error ?? blocks.error} onRetry={() => void Promise.all([material.refetch(), blocks.refetch()])} backTo="/admin/materi" backLabel="Kembali ke daftar materi" />
      ) : (
        <>
          <Card size="panel" className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-body-s text-text-secondary">{material.data.code}</span>
              <ContentStatusPill status={material.data.status} />
              <span className="text-label text-text-secondary">{material.data.isRequired ? 'WAJIB' : 'TIDAK WAJIB'}</span>
            </div>
            <h1 className="break-words text-h2">{material.data.title}</h1>
            <p className="text-body-s text-text-secondary">Susun blok konten di bawah, lalu simpan. Urutan blok sama dengan urutan yang dilihat Santri.</p>
          </Card>
          {notice.element}
          <BlockEditor key={blocks.dataUpdatedAt} materialId={id} server={blocks.data} notice={notice} backRef={backRef} />
        </>
      )}
    </div>
  );
}
