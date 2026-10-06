import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { ReorderableList, ReorderBar } from '../../../components/ui/ReorderableList';
import { ApiError } from '../../../lib/api/ApiError';
import { useReorder } from '../../../lib/hooks/useReorder';
import { EmptyState, ErrorState, ListSkeleton } from '../../learning/QueryStates';
import { ContentFormDialog } from './ContentFormDialog';
import { ContentStatusActions, ContentStatusPill } from './ContentStatusActions';
import { useAdminStages, useStageMutations } from './hooks';
import type { AdminStage } from './types';
import { useContentNotice } from './useContentNotice';
import { ACTION_TARGET, STATUS_LABEL, type ContentAction } from './view';

type FormState = { mode: 'create' } | { mode: 'edit'; stage: AdminStage } | null;

// Manajemen Tahapan (SDD 7.7.18, UI-ADMIN-CONTENT-01, FR-CONTENT-01). [REKOMENDASI] Tidak ada desain Figma untuk admin.
export function StageManagementPage(): JSX.Element {
  const stages = useAdminStages();
  const mutations = useStageMutations();
  const reorder = useReorder(stages.data ?? [], (stage) => stage.id);
  const notice = useContentNotice();
  const [form, setForm] = useState<FormState>(null);
  const [deleting, setDeleting] = useState<AdminStage | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const restoreFocus = () => triggerRef.current?.focus();
  const closeForm = useCallback((saved: boolean) => {
    setForm(null);
    if (!saved) triggerRef.current?.focus();
  }, []);
  const closeDelete = useCallback(() => {
    setDeleting(null);
    setDeleteError(null);
    triggerRef.current?.focus();
  }, []);

  const onAction = (stage: AdminStage, action: ContentAction, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    notice.clear();
    if (action === 'delete') {
      setDeleting(stage);
      return;
    }
    const status = ACTION_TARGET[action];
    mutations.update.mutate(
      { id: stage.id, input: { status } },
      { onSuccess: () => notice.success(`Status "${stage.title}" menjadi ${STATUS_LABEL[status]}.`), onError: notice.failure, onSettled: restoreFocus },
    );
  };

  const saveOrder = () => {
    notice.clear();
    mutations.reorder.mutate(reorder.orderedIds, {
      onSuccess: () => {
        reorder.reset();
        notice.success('Urutan tahapan tersimpan.');
      },
      onError: (error) => {
        // 422 CONTENT_REORDER_INCOMPLETE: daftar berubah di server; pesan lalu muat ulang.
        notice.failure(error);
        reorder.reset();
      },
    });
  };

  const confirmDelete = () => {
    if (!deleting) return;
    mutations.remove.mutate(deleting.id, {
      onSuccess: () => {
        notice.success(`Tahapan "${deleting.title}" dihapus.`);
        setDeleting(null);
        setDeleteError(null);
      },
      onError: (error) => setDeleteError(error instanceof ApiError ? error.message : 'Data gagal dihapus. Silakan coba lagi.'),
    });
  };

  const busy = reorder.dirty || mutations.update.isPending;

  let content: JSX.Element;
  if (stages.isPending) {
    content = <ListSkeleton rows={4} />;
  } else if (stages.isError) {
    content = <ErrorState error={stages.error} onRetry={() => void stages.refetch()} backTo="/admin" backLabel="Kembali ke dashboard" />;
  } else if (reorder.items.length === 0) {
    content = <EmptyState>Belum ada tahapan. Tambahkan tahapan pertama.</EmptyState>;
  } else {
    content = (
      <ReorderableList
        items={reorder.items}
        getId={(stage) => stage.id}
        getLabel={(stage) => stage.title}
        onMove={reorder.move}
        disabled={mutations.reorder.isPending}
        label="Daftar tahapan"
        renderItem={(stage, index) => (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-body-s text-text-secondary">
                {index + 1}. {stage.code}
              </span>
              <ContentStatusPill status={stage.status} />
            </div>
            <p className="break-words text-h3 text-text-primary">{stage.title}</p>
            {stage.description && <p className="break-words text-body-s text-text-secondary">{stage.description}</p>}
            <div className="flex flex-wrap items-center gap-x-4 text-body-s text-text-secondary">
              <span>{stage.materialCount} materi</span>
              <Link to={`/admin/materi?stageId=${encodeURIComponent(stage.id)}`} className="flex min-h-11 items-center text-brand-primary hover:underline">
                Lihat materi
              </Link>
            </div>
            <div className="flex flex-wrap items-start gap-x-2">
              <button
                type="button"
                disabled={busy}
                onClick={(event) => {
                  triggerRef.current = event.currentTarget;
                  notice.clear();
                  setForm({ mode: 'edit', stage });
                }}
                aria-label={`Ubah: ${stage.title}`}
                className="min-h-11 rounded-md px-3 text-body text-brand-primary hover:bg-neutral-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary disabled:text-text-muted"
              >
                Ubah
              </button>
              <ContentStatusActions
                status={stage.status}
                isReferenced={stage.isReferenced}
                name={stage.title}
                disabled={busy}
                deleteBlockedReason={stage.materialCount > 0 ? 'Tahapan yang masih berisi materi tidak dapat dihapus.' : undefined}
                onAction={(action, trigger) => onAction(stage, action, trigger)}
              />
            </div>
          </div>
        )}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-6">
      <h1 className="sr-only">Manajemen Tahapan</h1>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-s text-text-secondary">{stages.data ? `${stages.data.length} tahapan` : ''}</p>
        <Button
          disabled={reorder.dirty}
          onClick={(event) => {
            triggerRef.current = event.currentTarget;
            notice.clear();
            setForm({ mode: 'create' });
          }}
        >
          TAMBAH TAHAPAN
        </Button>
      </div>
      {notice.element}
      {content}
      {reorder.dirty && <ReorderBar onSave={saveOrder} onCancel={reorder.reset} saving={mutations.reorder.isPending} />}
      {form && (
        <ContentFormDialog
          kind="stage"
          initial={form.mode === 'edit' ? { code: form.stage.code, title: form.stage.title, description: form.stage.description ?? '', isRequired: true } : undefined}
          onSubmit={async (values) => {
            if (form.mode === 'edit') {
              await mutations.update.mutateAsync({ id: form.stage.id, input: { title: values.title, description: values.description } });
              notice.success('Data berhasil disimpan.');
            } else {
              const created = await mutations.create.mutateAsync({ title: values.title, description: values.description });
              notice.success(`Tahapan "${created.title}" ditambahkan dengan status DRAFT.`);
            }
          }}
          onClose={closeForm}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Hapus tahapan?"
          message={`Apakah Anda yakin ingin menghapus "${deleting.title}"? Tindakan ini tidak dapat dibatalkan.`}
          confirmLabel="HAPUS"
          pending={mutations.remove.isPending}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={closeDelete}
        />
      )}
    </div>
  );
}
