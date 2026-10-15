import { useCallback, useRef, useState, type RefObject } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { ReorderableList, ReorderBar } from '../../../components/ui/ReorderableList';
import { SelectField } from '../../../components/ui/SelectField';
import { ApiError } from '../../../lib/api/ApiError';
import { useReorder } from '../../../lib/hooks/useReorder';
import { EmptyState, ErrorState, ListSkeleton } from '../../learning/QueryStates';
import { ContentFormDialog } from './ContentFormDialog';
import { ContentStatusActions, ContentStatusPill } from './ContentStatusActions';
import { useAdminMaterials, useAdminStages, useMaterialMutations } from './hooks';
import type { AdminMaterial, AdminStage } from './types';
import { isContentInUse, useConflictFocus } from './conflictFocus';
import { useContentNotice } from './useContentNotice';
import { ACTION_TARGET, STATUS_LABEL, type ContentAction } from './view';

type FormState = { mode: 'create' } | { mode: 'edit'; material: AdminMaterial } | null;

const textButton =
  'min-h-11 rounded-md px-3 text-body text-brand-primary hover:bg-neutral-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary disabled:text-text-muted';

/** Daftar materi satu tahapan. Di-key dengan id tahapan agar urutan lokal tidak terbawa ke tahapan lain. */
function MaterialList({ stage, headingRef }: { stage: AdminStage; headingRef: RefObject<HTMLHeadingElement> }): JSX.Element {
  const materials = useAdminMaterials(stage.id);
  const mutations = useMaterialMutations();
  const reorder = useReorder(materials.data ?? [], (material) => material.id);
  const notice = useContentNotice();
  const [form, setForm] = useState<FormState>(null);
  const [deleting, setDeleting] = useState<AdminMaterial | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const closeForm = useCallback((saved: boolean) => {
    setForm(null);
    if (!saved) triggerRef.current?.focus();
  }, []);
  const [deleteConflict, setDeleteConflict] = useState(false);
  const focusAfterConflict = useConflictFocus(materials.isFetching, headingRef);
  const closeDelete = useCallback(() => {
    // 409 CONTENT_IN_USE: tombol Hapus nonaktif setelah daftar dimuat ulang, jadi fokus dipindah ke "Ubah" baris yang sama.
    if (deleteConflict && deleting) focusAfterConflict(deleting.id);
    else triggerRef.current?.focus();
    setDeleting(null);
    setDeleteError(null);
    setDeleteConflict(false);
  }, [deleteConflict, deleting, focusAfterConflict]);

  const onAction = (material: AdminMaterial, action: ContentAction, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    notice.clear();
    if (action === 'delete') {
      setDeleting(material);
      return;
    }
    const status = ACTION_TARGET[action];
    mutations.update.mutate(
      { id: material.id, input: { status } },
      { onSuccess: () => notice.success(`Status "${material.title}" menjadi ${STATUS_LABEL[status]}.`), onError: notice.failure, onSettled: () => triggerRef.current?.focus() },
    );
  };

  const saveOrder = () => {
    notice.clear();
    mutations.reorder.mutate(reorder.orderedIds, {
      onSuccess: () => {
        reorder.reset();
        notice.success('Urutan materi tersimpan.');
      },
      onError: (error) => {
        notice.failure(error);
        reorder.reset();
      },
    });
  };

  const confirmDelete = () => {
    if (!deleting) return;
    mutations.remove.mutate(deleting.id, {
      onSuccess: () => {
        notice.success(`Materi "${deleting.title}" dihapus.`);
        setDeleting(null);
        setDeleteError(null);
      },
      onError: (error) => {
        setDeleteError(error instanceof ApiError ? error.message : 'Data gagal dihapus. Silakan coba lagi.');
        setDeleteConflict(isContentInUse(error));
      },
    });
  };

  const busy = reorder.dirty || mutations.update.isPending;

  let content: JSX.Element;
  if (materials.isPending) {
    content = <ListSkeleton rows={4} />;
  } else if (materials.isError) {
    content = <ErrorState error={materials.error} onRetry={() => void materials.refetch()} backTo="/admin/tahapan" backLabel="Kembali ke daftar tahapan" />;
  } else if (reorder.items.length === 0) {
    content = <EmptyState>Belum ada materi pada tahapan ini. Tambahkan materi pertama.</EmptyState>;
  } else {
    content = (
      <ReorderableList
        items={reorder.items}
        getId={(material) => material.id}
        getLabel={(material) => material.title}
        onMove={reorder.move}
        disabled={mutations.reorder.isPending}
        label={`Daftar materi ${stage.title}`}
        renderItem={(material, index) => (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-body-s text-text-secondary">
                {index + 1}. {material.code}
              </span>
              <ContentStatusPill status={material.status} />
              {/* FR-LEARN-07: Wajib/Tidak wajib sebagai teks. */}
              <span className="text-label text-text-secondary">{material.isRequired ? 'WAJIB' : 'TIDAK WAJIB'}</span>
            </div>
            <p className="break-words text-h3 text-text-primary">{material.title}</p>
            {material.summary && <p className="break-words text-body-s text-text-secondary">{material.summary}</p>}
            <div className="flex flex-wrap items-center gap-x-4 text-body-s text-text-secondary">
              <span>
                {material.blockCount} blok · {material.taskCount} tugas
              </span>
              <Link to={`/admin/materi/${encodeURIComponent(material.id)}`} className="flex min-h-11 items-center text-brand-primary hover:underline">
                Sunting konten
              </Link>
            </div>
            <div className="flex flex-wrap items-start gap-x-2">
              <button
                type="button"
                disabled={busy}
                onClick={(event) => {
                  triggerRef.current = event.currentTarget;
                  notice.clear();
                  setForm({ mode: 'edit', material });
                }}
                aria-label={`Ubah: ${material.title}`}
                data-edit
                className={textButton}
              >
                Ubah
              </button>
              <ContentStatusActions status={material.status} isReferenced={material.isReferenced} name={material.title} disabled={busy} onAction={(action, trigger) => onAction(material, action, trigger)} />
            </div>
          </div>
        )}
      />
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-s text-text-secondary">{materials.data ? `${materials.data.length} materi` : ''}</p>
        <Button
          disabled={reorder.dirty}
          onClick={(event) => {
            triggerRef.current = event.currentTarget;
            notice.clear();
            setForm({ mode: 'create' });
          }}
        >
          TAMBAH MATERI
        </Button>
      </div>
      {notice.element}
      {content}
      {reorder.dirty && <ReorderBar onSave={saveOrder} onCancel={reorder.reset} saving={mutations.reorder.isPending} />}
      {form && (
        <ContentFormDialog
          kind="material"
          initial={form.mode === 'edit' ? { code: form.material.code, title: form.material.title, description: form.material.summary ?? '', isRequired: form.material.isRequired } : undefined}
          onSubmit={async (values) => {
            if (form.mode === 'edit') {
              await mutations.update.mutateAsync({ id: form.material.id, input: { title: values.title, summary: values.description, isRequired: values.isRequired } });
              notice.success('Data berhasil disimpan.');
            } else {
              const created = await mutations.create.mutateAsync({ stageId: stage.id, title: values.title, summary: values.description, isRequired: values.isRequired });
              notice.success(`Materi "${created.title}" ditambahkan dengan status DRAFT.`);
            }
          }}
          onClose={closeForm}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Hapus materi?"
          message={`Apakah Anda yakin ingin menghapus "${deleting.title}"? Tindakan ini tidak dapat dibatalkan.`}
          confirmLabel="HAPUS"
          pending={mutations.remove.isPending}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={closeDelete}
        />
      )}
    </>
  );
}

// Manajemen Materi (SDD 7.7.18, UI-ADMIN-CONTENT-02/03, FR-CONTENT-02, FR-LEARN-07). Tahapan dipilih lewat
// ?stageId= (bawaan: tahapan pertama). [REKOMENDASI] Tidak ada desain Figma untuk admin.
export function MaterialManagementPage(): JSX.Element {
  const stages = useAdminStages();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [params, setParams] = useSearchParams();
  const requested = params.get('stageId') ?? '';
  const stage = stages.data?.find((item) => item.id === requested) ?? stages.data?.[0];

  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-6">
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        Manajemen Materi
      </h1>
      {stages.isPending ? (
        <ListSkeleton rows={4} />
      ) : stages.isError ? (
        <ErrorState error={stages.error} onRetry={() => void stages.refetch()} backTo="/admin" backLabel="Kembali ke dashboard" />
      ) : !stage ? (
        <EmptyState>Belum ada tahapan. Tambahkan tahapan terlebih dahulu di halaman Tahapan.</EmptyState>
      ) : (
        <>
          <div className="sm:max-w-md">
            <SelectField label="Tahapan" value={stage.id} onChange={(stageId) => setParams({ stageId })}>
              {stages.data.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} — {item.title} ({STATUS_LABEL[item.status]})
                </option>
              ))}
            </SelectField>
          </div>
          <MaterialList key={stage.id} stage={stage} headingRef={headingRef} />
        </>
      )}
    </div>
  );
}
