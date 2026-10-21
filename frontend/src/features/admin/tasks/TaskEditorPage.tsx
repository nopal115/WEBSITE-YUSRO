import { ArrowLeft, CheckCircle2, Edit2, Plus, Trash2, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { OnDemandAudioPlayer } from '../../../components/audio/OnDemandAudioPlayer';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Pill } from '../../../components/ui/Pill';
import { SelectField } from '../../../components/ui/SelectField';
import { TextField } from '../../../components/ui/TextField';
import { ApiError } from '../../../lib/api/ApiError';
import { EmptyState, ErrorState, ListSkeleton } from '../../learning/QueryStates';
import { adminAudioApi } from '../audio/api';
import { useAdminAudioList } from '../audio/hooks';
import { useContentNotice } from '../content/useContentNotice';
import { useAdminTaskDetail, useTaskMutations } from './hooks';
import type { QuestionInput, QuestionItem } from './types';

export function TaskEditorPage(): JSX.Element {
  const { taskId = '' } = useParams<{ taskId: string }>();
  const navigate = useNavigate();

  const taskQuery = useAdminTaskDetail(taskId);
  const mutations = useTaskMutations();
  const audioListQuery = useAdminAudioList();
  const notice = useContentNotice();

  // Edit Task Metadata state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskOrder, setTaskOrder] = useState('1');
  const [taskRefAudioId, setTaskRefAudioId] = useState('');
  const [isSavingMeta, setIsSavingMeta] = useState(false);

  // Question Modal state
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [prompt, setPrompt] = useState('');
  const [audioId, setAudioId] = useState('');
  const [options, setOptions] = useState<Array<{ id?: string; text: string; isCorrect: boolean }>>([
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ]);
  const [questionError, setQuestionError] = useState<string | null>(null);

  // Delete Question state
  const [deletingQuestion, setDeletingQuestion] = useState<QuestionItem | null>(null);
  const [deleteQuestionError, setDeleteQuestionError] = useState<string | null>(null);

  useEffect(() => {
    if (taskQuery.data) {
      setTaskTitle(taskQuery.data.title);
      setTaskOrder(String(taskQuery.data.order));
      setTaskRefAudioId(taskQuery.data.referenceAudioId || '');
    }
  }, [taskQuery.data]);

  const handleSaveMeta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      notice.failureText('Judul tugas tidak boleh kosong.');
      return;
    }
    setIsSavingMeta(true);
    mutations.update.mutate(
      {
        id: taskId,
        input: {
          title: taskTitle.trim(),
          order: Number(taskOrder) || 1,
          referenceAudioId: taskQuery.data?.type === 'IMITATION' ? taskRefAudioId || null : null,
        },
      },
      {
        onSuccess: () => {
          setIsSavingMeta(false);
          notice.success('Informasi tugas berhasil diperbarui.');
        },
        onError: (err) => {
          setIsSavingMeta(false);
          notice.failureText(err instanceof ApiError ? err.message : 'Gagal memperbarui informasi tugas.');
        },
      },
    );
  };

  const handlePublish = () => {
    notice.clear();
    mutations.publish.mutate(taskId, {
      onSuccess: () => {
        notice.success('Tugas berhasil diterbitkan dan siap dikerjakan santri.');
      },
      onError: (err) => {
        const msg =
          err instanceof ApiError
            ? err.message === 'TASK_INCOMPLETE'
              ? 'Tugas belum lengkap: Kuis harus memiliki minimal 1 soal dengan minimal 2 opsi, atau imitasi belum memiliki audio referensi.'
              : err.message === 'TASK_ANSWER_KEY_INVALID'
                ? 'Kunci jawaban belum valid: Setiap soal harus memiliki tepat satu jawaban benar.'
                : err.message === 'TASK_REFERENCE_NOT_ACTIVE'
                  ? 'Audio referensi imitasi tidak aktif.'
                  : err.message
            : 'Gagal menerbitkan tugas.';
        notice.failureText(msg);
      },
    });
  };

  const openAddQuestion = () => {
    setEditingQuestion(null);
    setPrompt('');
    setAudioId('');
    setOptions([
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ]);
    setQuestionError(null);
    setQuestionModalOpen(true);
  };

  const openEditQuestion = (q: QuestionItem) => {
    setEditingQuestion(q);
    setPrompt(q.prompt);
    setAudioId(q.audioId || '');
    setOptions(
      q.options.map((opt) => ({
        id: opt.id,
        text: opt.text || opt.label || '',
        isCorrect: opt.isCorrect,
      })),
    );
    setQuestionError(null);
    setQuestionModalOpen(true);
  };

  const handleQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      setQuestionError('Teks soal wajib diisi.');
      return;
    }
    const filledOptions = options.filter((o) => o.text.trim() !== '');
    if (filledOptions.length < 2) {
      setQuestionError('Soal harus memiliki minimal 2 pilihan jawaban.');
      return;
    }
    const correctCount = filledOptions.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      setQuestionError('Tepat satu pilihan jawaban harus ditandai sebagai BENAR.');
      return;
    }

    setQuestionError(null);
    const input: QuestionInput = {
      prompt: prompt.trim(),
      audioId: audioId || null,
      options: filledOptions.map((o) => ({
        id: o.id,
        text: o.text.trim(),
        isCorrect: o.isCorrect,
      })),
    };

    if (editingQuestion) {
      mutations.updateQuestion.mutate(
        { questionId: editingQuestion.id, input },
        {
          onSuccess: () => {
            setQuestionModalOpen(false);
            notice.success('Soal berhasil diperbarui.');
          },
          onError: (err) => {
            setQuestionError(err instanceof ApiError ? err.message : 'Gagal memperbarui soal.');
          },
        },
      );
    } else {
      mutations.addQuestion.mutate(
        { taskId, input },
        {
          onSuccess: () => {
            setQuestionModalOpen(false);
            notice.success('Soal berhasil ditambahkan.');
          },
          onError: (err) => {
            setQuestionError(err instanceof ApiError ? err.message : 'Gagal menambahkan soal.');
          },
        },
      );
    }
  };

  const handleDeleteQuestionConfirm = () => {
    if (!deletingQuestion) return;
    setDeleteQuestionError(null);
    mutations.deleteQuestion.mutate(deletingQuestion.id, {
      onSuccess: () => {
        setDeletingQuestion(null);
        notice.success('Soal berhasil dihapus.');
      },
      onError: (err) => {
        setDeleteQuestionError(err instanceof ApiError ? err.message : 'Gagal menghapus soal.');
      },
    });
  };

  if (taskQuery.isPending) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (taskQuery.isError || !taskQuery.data) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <ErrorState
          error={taskQuery.error}
          onRetry={() => void taskQuery.refetch()}
          backTo="/admin/tugas"
          backLabel="Kembali ke daftar tugas"
        />
      </div>
    );
  }

  const task = taskQuery.data;
  const audioOptions = (audioListQuery.data ?? []).map((a) => ({
    value: a.id,
    label: `${a.originalName} (${Math.round((a.durationMs || 0) / 1000)} dtk)`,
  }));

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-5xl mx-auto">
      {notice.element}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/tugas"
            className="p-2 rounded-md hover:bg-neutral-surface-alt transition text-text-secondary"
            title="Kembali ke daftar tugas"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-h2 font-bold text-text-primary">{task.title}</h1>
              <Pill status={task.type === 'QUIZ' ? 'terbuka' : 'perhatian'}>
                {task.type === 'QUIZ' ? 'Dengar-Pilih' : 'Dengar-Tirukan'}
              </Pill>
              <Pill status={task.status === 'ACTIVE' ? 'selesai' : 'terkunci'}>
                {task.status === 'ACTIVE' ? 'Aktif' : 'Draf'}
              </Pill>
            </div>
            <p className="text-body-s text-text-secondary mt-1">
              Tahapan: <strong>{task.stageTitle}</strong>
              {task.materialTitle ? ` • Materi: ${task.materialTitle}` : ''}
            </p>
          </div>
        </div>

        {task.status !== 'ACTIVE' && (
          <Button
            onClick={handlePublish}
            isLoading={mutations.publish.isPending}
            className="shrink-0"
          >
            <CheckCircle2 size={18} className="mr-2 text-feedback-benar" /> Terbitkan Tugas
          </Button>
        )}
      </div>

      {/* Form Informasi Tugas */}
      <Card className="p-6">
        <h2 className="text-h3 font-bold text-text-primary mb-4">Pengaturan Tugas</h2>
        <form onSubmit={handleSaveMeta} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField
              label="Judul Tugas"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              required
            />
            <TextField
              label="Nomor Urutan"
              type="number"
              min="1"
              value={taskOrder}
              onChange={(e) => setTaskOrder(e.target.value)}
              required
            />
          </div>

          {task.type === 'IMITATION' && (
            <div className="flex flex-col gap-2">
              <SelectField
                label="Audio Referensi Makhraj (Wajib)"
                value={taskRefAudioId}
                onChange={(val) => setTaskRefAudioId(val)}
              >
                <option value="">-- Tanpa Audio --</option>
                {audioOptions.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </SelectField>
              {task.referenceAudioId && (
                <div className="mt-2 p-3 bg-neutral-surface-alt rounded-md flex items-center justify-between">
                  <div className="flex items-center gap-2 text-body-s font-medium text-text-primary">
                    <Volume2 size={18} className="text-brand-primary" />
                    <span>{task.referenceAudio?.originalName ?? 'Audio Referensi'}</span>
                  </div>
                  <OnDemandAudioPlayer
                    fetchUrl={async () => (await adminAudioApi.getUrl(task.referenceAudioId!)).url}
                    label="Audio Referensi"
                    buttonText="Putar Referensi"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="outline" isLoading={isSavingMeta}>
              Simpan Pengaturan
            </Button>
          </div>
        </form>
      </Card>

      {/* Editor Soal (Khusus Kuis / Dengar-Pilih) */}
      {task.type === 'QUIZ' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-h2 font-bold text-text-primary">Butir Soal ({task.questions.length})</h2>
              <p className="text-body-s text-text-secondary">
                Setiap soal memuat instruksi/pertanyaan, opsi audio suara makhraj, dan 2-4 pilihan jawaban.
              </p>
            </div>
            <Button onClick={openAddQuestion}>
              <Plus size={18} className="mr-2" /> Tambah Soal
            </Button>
          </div>

          {task.questions.length === 0 ? (
            <EmptyState>Belum ada soal pada kuis ini. Tambahkan minimal 1 soal untuk menerbitkan tugas.</EmptyState>
          ) : (
            <div className="flex flex-col gap-4">
              {task.questions.map((q, idx) => (
                <Card key={q.id} className="p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-brand-primary/10 text-brand-primary font-bold text-body-s">
                        {idx + 1}
                      </span>
                      <h3 className="text-body font-semibold text-text-primary">{q.prompt}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        className="!h-9 !px-3 text-body-s"
                        onClick={() => openEditQuestion(q)}
                        title="Edit soal"
                      >
                        <Edit2 size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        className="!h-9 !px-3 text-body-s text-feedback-salah hover:bg-feedback-salah-soft"
                        onClick={() => {
                          setDeletingQuestion(q);
                          setDeleteQuestionError(null);
                        }}
                        title="Hapus soal"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>

                  {q.audioId && (
                    <div className="flex items-center gap-2 pl-10">
                      <OnDemandAudioPlayer
                        fetchUrl={async () => (await adminAudioApi.getUrl(q.audioId!)).url}
                        label={`Soal ${idx + 1}`}
                        buttonText="Putar Audio Soal"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-10 mt-1">
                    {q.options.map((opt) => (
                      <div
                        key={opt.id ?? opt.text}
                        className={`p-3 rounded-md border text-body-s flex items-center justify-between ${
                          opt.isCorrect
                            ? 'bg-feedback-benar-soft border-feedback-benar text-feedback-benar font-medium'
                            : 'bg-neutral-surface border-neutral-border text-text-primary'
                        }`}
                      >
                        <span>{opt.text || opt.label}</span>
                        {opt.isCorrect && (
                          <span className="text-xs uppercase font-bold tracking-wider">Jawaban Benar</span>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Tambah / Edit Soal */}
      {questionModalOpen && (
        <dialog
          open
          className="fixed inset-0 z-50 flex items-center justify-center w-full h-full bg-text-primary/40 backdrop:bg-text-primary/40 p-4"
        >
          <div className="w-full max-w-lg bg-neutral-surface rounded-lg shadow-raised p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-h2 font-bold text-text-primary">
              {editingQuestion ? 'Edit Butir Soal' : 'Tambah Butir Soal Kuis'}
            </h2>
            <form onSubmit={handleQuestionSubmit} className="flex flex-col gap-4">
              <TextField
                label="Pertanyaan / Instruksi Soal"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Contoh: Manakah huruf yang dibaca dengan makhraj tersebut?"
                required
              />

              <SelectField
                label="Audio Soal (Opsional)"
                value={audioId}
                onChange={(val) => setAudioId(val)}
              >
                <option value="">-- Tanpa Audio --</option>
                {audioOptions.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </SelectField>

              <div className="flex flex-col gap-2">
                <label className="text-body-s font-semibold text-text-primary">
                  Pilihan Jawaban (Tandai Tepat Satu Jawaban Benar)
                </label>
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctOption"
                      checked={opt.isCorrect}
                      onChange={() => {
                        setOptions(options.map((o, index) => ({ ...o, isCorrect: index === i })));
                      }}
                      className="w-4 h-4 text-brand-primary focus:ring-brand-primary"
                      title="Tandai sebagai jawaban benar"
                    />
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => {
                        const val = e.target.value;
                        setOptions(options.map((o, index) => (index === i ? { ...o, text: val } : o)));
                      }}
                      placeholder={`Pilihan ${String.fromCharCode(65 + i)}`}
                      className="flex-1 rounded-md border border-neutral-border px-3 py-2 text-body focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                ))}
              </div>

              {questionError && (
                <p className="rounded-md bg-feedback-salah-soft px-4 py-2 text-body-s text-feedback-salah">
                  {questionError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setQuestionModalOpen(false);
                    setQuestionError(null);
                  }}
                  disabled={mutations.addQuestion.isPending || mutations.updateQuestion.isPending}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  isLoading={mutations.addQuestion.isPending || mutations.updateQuestion.isPending}
                >
                  {editingQuestion ? 'Perbarui Soal' : 'Simpan Soal'}
                </Button>
              </div>
            </form>
          </div>
        </dialog>
      )}

      {/* Delete Question Confirmation Dialog */}
      {deletingQuestion && (
        <ConfirmDialog
          title="Hapus Soal?"
          message={`Apakah Anda yakin ingin menghapus soal "${deletingQuestion.prompt}"?`}
          confirmLabel="HAPUS SOAL"
          confirmVariant="salah"
          pending={mutations.deleteQuestion.isPending}
          error={deleteQuestionError}
          onConfirm={handleDeleteQuestionConfirm}
          onClose={() => setDeletingQuestion(null)}
        />
      )}
    </div>
  );
}
