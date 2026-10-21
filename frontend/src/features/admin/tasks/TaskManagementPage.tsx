import { CheckCircle2, Edit2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Pill } from '../../../components/ui/Pill';
import { SelectField } from '../../../components/ui/SelectField';
import { TextField } from '../../../components/ui/TextField';
import { ApiError } from '../../../lib/api/ApiError';
import { EmptyState, ErrorState, ListSkeleton } from '../../learning/QueryStates';
import { useAdminAudioList } from '../audio/hooks';
import { useAdminMaterials, useAdminStages } from '../content/hooks';
import { useContentNotice } from '../content/useContentNotice';
import { useAdminTasksList, useTaskMutations } from './hooks';
import type { AdminTaskListItem, TaskType } from './types';

export function TaskManagementPage(): JSX.Element {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState('ALL');
  const notice = useContentNotice();

  // Dialog Tambah Tugas
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('QUIZ');
  const [stageId, setStageId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [order, setOrder] = useState('1');
  const [referenceAudioId, setReferenceAudioId] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Dialog Hapus Tugas
  const [deletingTask, setDeletingTask] = useState<AdminTaskListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const tasksQuery = useAdminTasksList(selectedType);
  const stagesQuery = useAdminStages();
  const materialsQuery = useAdminMaterials(stageId);
  const audioQuery = useAdminAudioList('REFERENCE');
  const mutations = useTaskMutations();

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setCreateError('Judul tugas wajib diisi.');
      return;
    }
    if (!stageId) {
      setCreateError('Pilih tahapan untuk tugas ini.');
      return;
    }
    if (taskType === 'IMITATION' && !referenceAudioId) {
      setCreateError('Tugas imitasi wajib memilih audio referensi makhraj.');
      return;
    }
    setCreateError(null);

    mutations.create.mutate(
      {
        title: title.trim(),
        type: taskType,
        stageId,
        materialId: materialId || null,
        order: Number(order) || 1,
        referenceAudioId: taskType === 'IMITATION' ? referenceAudioId : null,
      },
      {
        onSuccess: (created) => {
          setCreateOpen(false);
          notice.success('Tugas berhasil dibuat.');
          navigate(`/admin/tugas/${created.id}`);
        },
        onError: (err) => {
          setCreateError(err instanceof ApiError ? err.message : 'Gagal membuat tugas.');
        },
      },
    );
  };

  const handlePublish = (task: AdminTaskListItem) => {
    notice.clear();
    mutations.publish.mutate(task.id, {
      onSuccess: () => {
        notice.success(`Tugas "${task.title}" berhasil diterbitkan dan aktif.`);
      },
      onError: (err) => {
        const msg =
          err instanceof ApiError
            ? err.message === 'TASK_INCOMPLETE'
              ? 'Tugas belum lengkap: Kuis harus memiliki minimal 1 soal dan 2 pilihan, atau audio referensi imitasi belum terpasang.'
              : err.message === 'TASK_ANSWER_KEY_INVALID'
                ? 'Kunci jawaban belum valid: Setiap soal harus memiliki tepat satu jawaban benar.'
                : err.message === 'TASK_REFERENCE_NOT_ACTIVE'
                  ? 'Audio referensi imitasi tidak aktif atau telah diarsipkan.'
                  : err.message
            : 'Gagal menerbitkan tugas.';
        notice.failureText(msg);
      },
    });
  };

  const handleDeleteConfirm = () => {
    if (!deletingTask) return;
    setDeleteError(null);
    mutations.remove.mutate(deletingTask.id, {
      onSuccess: () => {
        setDeletingTask(null);
        notice.success(`Tugas "${deletingTask.title}" berhasil dihapus.`);
      },
      onError: (err) => {
        const msg =
          err instanceof ApiError && err.message === 'TASK_IN_USE'
            ? 'Tugas ini sudah dikerjakan santri dan tidak dapat dihapus.'
            : 'Gagal menghapus tugas.';
        setDeleteError(msg);
      },
    });
  };

  let listContent: JSX.Element;
  if (tasksQuery.isPending) {
    listContent = <ListSkeleton rows={5} />;
  } else if (tasksQuery.isError) {
    listContent = (
      <ErrorState
        error={tasksQuery.error}
        onRetry={() => void tasksQuery.refetch()}
        backTo="/admin"
        backLabel="Kembali ke dashboard"
      />
    );
  } else if (!tasksQuery.data || tasksQuery.data.length === 0) {
    listContent = <EmptyState>Belum ada tugas. Klik "+ Tambah Tugas" untuk membuat tugas baru.</EmptyState>;
  } else {
    listContent = (
      <div className="overflow-x-auto rounded-lg border border-neutral-border bg-neutral-surface">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-border bg-neutral-surface-alt text-body-s font-semibold text-text-secondary">
              <th className="py-3 px-4">Judul Tugas</th>
              <th className="py-3 px-4">Jenis</th>
              <th className="py-3 px-4">Tahapan & Materi</th>
              <th className="py-3 px-4">Urutan</th>
              <th className="py-3 px-4">Konten</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-border text-body">
            {tasksQuery.data.map((task) => (
              <tr key={task.id} className="hover:bg-neutral-surface-alt/40 transition">
                <td className="py-3 px-4 font-medium text-text-primary">
                  <Link
                    to={`/admin/tugas/${task.id}`}
                    className="hover:text-brand-primary underline decoration-dotted"
                  >
                    {task.title}
                  </Link>
                </td>
                <td className="py-3 px-4">
                  <Pill status={task.type === 'QUIZ' ? 'terbuka' : 'perhatian'}>
                    {task.type === 'QUIZ' ? 'Dengar-Pilih' : 'Dengar-Tirukan'}
                  </Pill>
                </td>
                <td className="py-3 px-4 text-body-s text-text-secondary">
                  <div>{task.stageTitle}</div>
                  {task.materialTitle && <div className="text-text-muted">{task.materialTitle}</div>}
                </td>
                <td className="py-3 px-4 text-text-secondary">#{task.order}</td>
                <td className="py-3 px-4 text-body-s">
                  {task.type === 'QUIZ' ? (
                    <span className="font-medium text-text-primary">{task.questionCount} Soal</span>
                  ) : (
                    <span className="text-text-secondary">
                      {task.referenceAudioId ? 'Audio Terpasang' : 'Belum Ada Audio'}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <Pill status={task.status === 'ACTIVE' ? 'selesai' : 'terkunci'}>
                    {task.status === 'ACTIVE' ? 'Aktif' : 'Draf'}
                  </Pill>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {task.status !== 'ACTIVE' && (
                      <Button
                        variant="outline"
                        className="!h-9 !px-3 text-body-s"
                        onClick={() => handlePublish(task)}
                        isLoading={mutations.publish.isPending}
                        title="Terbitkan tugas agar santri dapat mengerjakannya"
                      >
                        <CheckCircle2 size={14} className="mr-1 text-feedback-benar" /> Terbitkan
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="!h-9 !px-3 text-body-s"
                      onClick={() => navigate(`/admin/tugas/${task.id}`)}
                      title="Edit tugas dan butir soal"
                    >
                      <Edit2 size={14} className="mr-1" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      className="!h-9 !px-3 text-body-s text-feedback-salah hover:bg-feedback-salah-soft disabled:opacity-40"
                      onClick={() => {
                        setDeletingTask(task);
                        setDeleteError(null);
                      }}
                      disabled={task.isReferenced}
                      title={task.isReferenced ? 'Tugas sudah dikerjakan, tidak dapat dihapus' : 'Hapus tugas'}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const stageOptions = (stagesQuery.data ?? []).map((s) => ({ value: s.id, label: s.title }));
  const materialOptions = [
    { value: '', label: 'Tugas Akhir Tahapan (Tanpa Materi)' },
    ...(materialsQuery.data ?? []).map((m) => ({ value: m.id, label: m.title })),
  ];
  const audioOptions = (audioQuery.data ?? []).map((a) => ({
    value: a.id,
    label: `${a.originalName} (${Math.round((a.durationMs || 0) / 1000)} dtk)`,
  }));

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-6xl mx-auto">
      {notice.element}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-h1 font-bold text-text-primary">Manajemen Tugas & Soal</h1>
          <p className="text-body text-text-secondary">
            Kelola tugas evaluasi santri: Kuis (Dengar-Pilih) dan Peniruan Makhraj (Dengar-Tirukan).
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={18} className="mr-2" /> Tambah Tugas
        </Button>
      </div>

      <div className="w-full sm:w-64">
        <SelectField
          label="Filter Jenis Tugas"
          value={selectedType}
          onChange={(val) => setSelectedType(val)}
        >
          <option value="ALL">Semua Jenis</option>
          <option value="QUIZ">Kuis (Dengar-Pilih)</option>
          <option value="IMITATION">Imitasi (Dengar-Tirukan)</option>
        </SelectField>
      </div>

      {listContent}

      {/* Modal Tambah Tugas */}
      {createOpen && (
        <dialog
          open
          className="fixed inset-0 z-50 flex items-center justify-center w-full h-full bg-text-primary/40 backdrop:bg-text-primary/40 p-4"
        >
          <div className="w-full max-w-lg bg-neutral-surface rounded-lg shadow-raised p-6 flex flex-col gap-4">
            <h2 className="text-h2 font-bold text-text-primary">Buat Tugas Baru</h2>
            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
              <TextField
                label="Judul Tugas"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Kuis Dengar-Pilih Huruf Hijaiyah"
                required
              />

              <SelectField
                label="Jenis Tugas"
                value={taskType}
                onChange={(val) => setTaskType(val as TaskType)}
              >
                <option value="QUIZ">Kuis (Dengar-Pilih / Pilihan Ganda Audio)</option>
                <option value="IMITATION">Imitasi (Dengar-Tirukan / Evaluasi Suara Santri)</option>
              </SelectField>

              <SelectField
                label="Pilih Tahapan"
                value={stageId}
                onChange={(val) => {
                  setStageId(val);
                  setMaterialId('');
                }}
              >
                <option value="">-- Pilih Tahapan --</option>
                {stageOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </SelectField>

              {stageId && (
                <SelectField
                  label="Pilih Materi (Opsional)"
                  value={materialId}
                  onChange={(val) => setMaterialId(val)}
                >
                  {materialOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </SelectField>
              )}

              <TextField
                label="Nomor Urutan"
                type="number"
                min="1"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                required
              />

              {taskType === 'IMITATION' && (
                <SelectField
                  label="Audio Referensi Makhraj (Wajib untuk Imitasi)"
                  value={referenceAudioId}
                  onChange={(val) => setReferenceAudioId(val)}
                >
                  <option value="">-- Pilih Audio Referensi --</option>
                  {audioOptions.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </SelectField>
              )}

              {createError && (
                <p className="rounded-md bg-feedback-salah-soft px-4 py-2 text-body-s text-feedback-salah">
                  {createError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCreateOpen(false);
                    setCreateError(null);
                  }}
                  disabled={mutations.create.isPending}
                >
                  Batal
                </Button>
                <Button type="submit" isLoading={mutations.create.isPending}>
                  Buat & Lanjut Edit
                </Button>
              </div>
            </form>
          </div>
        </dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingTask && (
        <ConfirmDialog
          title="Hapus Tugas?"
          message={`Apakah Anda yakin ingin menghapus tugas "${deletingTask.title}" beserta seluruh butir soalnya? Tindakan ini tidak dapat dibatalkan.`}
          confirmLabel="HAPUS TUGAS"
          confirmVariant="salah"
          pending={mutations.remove.isPending}
          error={deleteError}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeletingTask(null)}
        />
      )}
    </div>
  );
}
