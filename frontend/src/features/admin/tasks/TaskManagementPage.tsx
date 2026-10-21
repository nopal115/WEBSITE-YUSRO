import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { ReorderableList, ReorderBar } from '../../../components/ui/ReorderableList';
import { SelectField } from '../../../components/ui/SelectField';
import { ApiError } from '../../../lib/api/ApiError';
import { useReorder } from '../../../lib/hooks/useReorder';
import { EmptyState, ErrorState, ListSkeleton } from '../../learning/QueryStates';
import { ContentStatusActions, ContentStatusPill } from '../content/ContentStatusActions';
import { useAdminMaterials, useAdminStages } from '../content/hooks';
import type { AdminMaterial } from '../content/types';
import { useContentNotice } from '../content/useContentNotice';
import { STATUS_LABEL, type ContentAction } from '../content/view';
import { useAdminTasks, useTaskMutations } from './hooks';
import { TaskCreateDialog } from './TaskCreateDialog';
import type { AdminTask } from './types';
import { completenessText, statusRequest, TYPE_LABEL } from './view';

const textLink = 'flex min-h-11 items-center text-brand-primary hover:underline';

/** Daftar tugas satu materi; di-key dengan id materi agar urutan lokal tidak terbawa. */
function TaskList({ material }: { material: AdminMaterial }): JSX.Element {
  const tasks = useAdminTasks(material.id);
  const mutations = useTaskMutations();
  const reorder = useReorder(tasks.data ?? [], (task) => task.id);
  const notice = useContentNotice();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AdminTask | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const restoreFocus = () => triggerRef.current?.focus();
  const closeCreate = useCallback((saved: boolean) => {
    setCreating(false);
    if (!saved) triggerRef.current?.focus();
  }, []);
  const closeDelete = useCallback(() => {
    setDeleting(null);
    setDeleteError(null);
    triggerRef.current?.focus();
  }, []);

  const onAction = (task: AdminTask, action: ContentAction, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    notice.clear();
    const request = statusRequest(action);
    if (request.kind === 'delete') {
      setDeleting(task);
      return;
    }
    const done = { onError: notice.failure, onSettled: restoreFocus };
    if (request.kind === 'publish') mutations.publish.mutate(task.id, { ...done, onSuccess: () => notice.success(`"${task.title}" diaktifkan.`) });
    else mutations.update.mutate({ id: task.id, input: request.input }, { ...done, onSuccess: (saved) => notice.success(`Status "${task.title}" menjadi ${STATUS_LABEL[saved.status]}.`) });
  };

  const saveOrder = () => {
    notice.clear();
    mutations.reorder.mutate(reorder.orderedIds, {
      onSuccess: () => {
        reorder.reset();
        notice.success('Urutan tugas tersimpan.');
      },
      onError: (error) => {
        notice.failure(error);
        reorder.reset();
      },
    });
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const target = deleting;
    mutations.remove.mutate(target.id, {
      onSuccess: () => {
        notice.success(`Tugas "${target.title}" dihapus.`);
        setDeleting(null);
      },
      onError: (error) => setDeleteError(error instanceof ApiError ? error.message : 'Data gagal dihapus. Silakan coba lagi.'),
    });
  };

  const busy = reorder.dirty || mutations.update.isPending || mutations.publish.isPending;

  let content: JSX.Element;
  if (tasks.isPending) {
    content = <ListSkeleton rows={2} />;
  } else if (tasks.isError) {
    content = <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} backTo="/admin/materi" backLabel="Kembali ke daftar materi" />;
  } else if (reorder.items.length === 0) {
    content = <EmptyState>Belum ada tugas pada materi ini. Tambahkan tugas pertama.</EmptyState>;
  } else {
    content = (
      <ReorderableList
        items={reorder.items}
        getId={(task) => task.id}
        getLabel={(task) => task.title}
        onMove={reorder.move}
        disabled={mutations.reorder.isPending}
        label={`Daftar tugas ${material.title}`}
        renderItem={(task, index) => (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-body-s text-text-secondary">
                {index + 1}. {TYPE_LABEL[task.type]}
              </span>
              <ContentStatusPill status={task.status} />
              {!task.isComplete && <span className="text-label text-semantic-warning">BELUM LENGKAP</span>}
            </div>
            <p className="break-words text-h3 text-text-primary">{task.title}</p>
            <div className="flex flex-wrap items-center gap-x-4 text-body-s text-text-secondary">
              <span>{completenessText(task)}</span>
              <Link to={`/admin/tugas/${encodeURIComponent(task.id)}`} className={textLink} aria-label={`Atur tugas: ${task.title}`}>
                Atur tugas
              </Link>
            </div>
            <ContentStatusActions
              status={task.status}
              isReferenced={task.isReferenced}
              name={task.title}
              disabled={busy}
              onAction={(action, trigger) => onAction(task, action, trigger)}
            />
            {task.status !== 'ACTIVE' && !task.isComplete && (
              <p className="text-body-s text-text-secondary">Lengkapi {task.type === 'QUIZ' ? 'soal' : 'audio referensi'} sebelum mengaktifkan tugas.</p>
            )}
          </div>
        )}
      />
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-s text-text-secondary">{tasks.data ? `${tasks.data.length} tugas` : ''}</p>
        <Button
          disabled={reorder.dirty}
          onClick={(event) => {
            triggerRef.current = event.currentTarget;
            notice.clear();
            setCreating(true);
          }}
        >
          TAMBAH TUGAS
        </Button>
      </div>
      {notice.element}
      {content}
      {reorder.dirty && <ReorderBar onSave={saveOrder} onCancel={reorder.reset} saving={mutations.reorder.isPending} />}
      {creating && (
        <TaskCreateDialog
          materialTitle={material.title}
          onSubmit={async ({ type, title }) => {
            const created = await mutations.create.mutateAsync({ materialId: material.id, type, title });
            navigate(`/admin/tugas/${encodeURIComponent(created.id)}`);
          }}
          onClose={closeCreate}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Hapus tugas?"
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

/** Pilihan materi untuk tahapan terpilih; materi pertama dipakai bila belum ada di URL. */
function MaterialPicker({ stageId, materialId, onChange }: { stageId: string; materialId: string; onChange: (materialId: string) => void }): JSX.Element {
  const materials = useAdminMaterials(stageId);
  if (materials.isPending) return <ListSkeleton rows={2} />;
  if (materials.isError) return <ErrorState error={materials.error} onRetry={() => void materials.refetch()} backTo="/admin/materi" backLabel="Kembali ke daftar materi" />;
  const material = materials.data.find((item) => item.id === materialId) ?? materials.data[0];
  if (!material) return <EmptyState>Tahapan ini belum memiliki materi. Tambahkan materi terlebih dahulu di halaman Materi.</EmptyState>;
  return (
    <>
      <div className="sm:max-w-md">
        <SelectField label="Materi" value={material.id} onChange={onChange}>
          {materials.data.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} — {item.title} ({STATUS_LABEL[item.status]})
            </option>
          ))}
        </SelectField>
      </div>
      <TaskList key={material.id} material={material} />
    </>
  );
}

// Manajemen Tugas (SDD 5.17, 3.7; UI-ADMIN-TASK-01 sampai 03; FR-TASK-03, 05, 06).
// [ASUMSI] SDD 7.7 tidak punya bagian UI tugas dan tidak ada desain Figma admin; pola mengikuti halaman Materi (A4).
export function TaskManagementPage(): JSX.Element {
  const stages = useAdminStages();
  const [params, setParams] = useSearchParams();
  const stage = stages.data?.find((item) => item.id === params.get('stageId')) ?? stages.data?.[0];

  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-6">
      <h1 className="sr-only">Manajemen Tugas</h1>
      {stages.isPending ? (
        <ListSkeleton rows={3} />
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
          <MaterialPicker key={stage.id} stageId={stage.id} materialId={params.get('materialId') ?? ''} onChange={(materialId) => setParams({ stageId: stage.id, materialId })} />
        </>
      )}
    </div>
  );
}
