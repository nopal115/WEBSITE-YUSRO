import { useCallback, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { OnDemandAudioPlayer } from '../../../components/audio/OnDemandAudioPlayer';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { SelectField } from '../../../components/ui/SelectField';
import { TextField } from '../../../components/ui/TextField';
import { ApiError } from '../../../lib/api/ApiError';
import { ErrorState, ListSkeleton } from '../../learning/QueryStates';
import { adminAudioApi } from '../audio/api';
import { useAdminAudioList } from '../audio/hooks';
import { formatDuration } from '../audio/view';
import { ContentStatusActions, ContentStatusPill } from '../content/ContentStatusActions';
import { useContentNotice } from '../content/useContentNotice';
import { STATUS_LABEL, type ContentAction } from '../content/view';
import { useAdminTask, useQuestionMutations, useTaskMutations, useTaskQuestions } from './hooks';
import { QuestionFormDialog } from './QuestionFormDialog';
import type { AdminQuestion, AdminTaskDetail, TaskUpdateInput } from './types';
import { statusRequest, TITLE_MAX, TYPE_LABEL } from './view';

const textButton =
  'min-h-11 rounded-md px-3 text-body text-brand-primary hover:bg-neutral-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:text-text-muted';
const REFERENCE_FILTER = { kind: 'REFERENCE', status: 'ACTIVE' } as const;

type FieldErrors = { title?: string; instruction?: string; arabicText?: string; referenceAudioId?: string; general?: string };

/** Pengaturan tugas (UI-ADMIN-TASK-02, FR-TASK-04): judul, instruksi, dan untuk Dengar-Tirukan audio referensi. */
function TaskSettingsForm({ task, onSaved }: { task: AdminTaskDetail; onSaved: (text: string) => void }): JSX.Element {
  const mutations = useTaskMutations();
  const references = useAdminAudioList(REFERENCE_FILTER);
  const instructionId = useId();
  const arabicId = useId();
  const [title, setTitle] = useState(task.title);
  const [instruction, setInstruction] = useState(task.instruction ?? '');
  const [arabicText, setArabicText] = useState(task.arabicText ?? '');
  const [referenceAudioId, setReferenceAudioId] = useState(task.referenceAudioId ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const imitation = task.type === 'IMITATION';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setErrors({ title: 'Judul wajib diisi.' });
      return;
    }
    const input: TaskUpdateInput = { title: trimmed, instruction: instruction.trim() };
    if (imitation) {
      input.arabicText = arabicText.trim();
      if (referenceAudioId && referenceAudioId !== task.referenceAudioId) input.referenceAudioId = referenceAudioId;
    }
    setErrors({});
    mutations.update.mutate(
      { id: task.id, input },
      {
        onSuccess: () => onSaved('Data berhasil disimpan.'),
        onError: (error) => {
          const details = error instanceof ApiError && Array.isArray(error.details) ? (error.details as { field?: string; message?: string }[]) : [];
          const fieldError = (name: string) => details.find((item) => item.field === name)?.message;
          const referenceInactive = error instanceof ApiError && error.code === 'TASK_REFERENCE_NOT_ACTIVE';
          setErrors({
            title: fieldError('title'),
            instruction: fieldError('instruction'),
            arabicText: fieldError('arabicText'),
            referenceAudioId: fieldError('referenceAudioId') ?? (referenceInactive ? error.message : undefined),
            general: details.length === 0 && !referenceInactive ? (error instanceof ApiError ? error.message : 'Data gagal disimpan. Silakan coba lagi.') : undefined,
          });
        },
      },
    );
  };

  // Audio yang sedang terpasang tetap tampil walau sudah diarsipkan, agar admin tahu perlu menggantinya.
  const current = task.referenceAudio;
  const choices = references.data ?? [];
  const currentMissing = current && !choices.some((item) => item.id === current.id);

  return (
    <form className="flex flex-col gap-5 rounded-lg border-2 border-neutral-border bg-neutral-surface p-5 shadow-card" onSubmit={submit} noValidate>
      <h2 className="text-h3">Pengaturan tugas</h2>
      <TextField label="Judul" value={title} maxLength={TITLE_MAX} onChange={(event) => setTitle(event.target.value)} error={errors.title} />
      <div>
        <label htmlFor={instructionId} className={`flex flex-col gap-1 rounded-sm border-2 bg-neutral-surface px-5 py-3 ${errors.instruction ? 'border-feedback-salah' : 'border-neutral-border-strong focus-within:border-brand-primary'}`}>
          <span className="text-body-s text-text-muted">Instruksi (opsional)</span>
          <textarea id={instructionId} value={instruction} rows={2} onChange={(event) => setInstruction(event.target.value)} className="w-full resize-y bg-transparent p-0 text-body text-text-primary outline-none" />
        </label>
        {errors.instruction && <p className="mt-1 text-body-s text-feedback-salah">{errors.instruction}</p>}
      </div>
      {imitation && (
        <>
          <div className="flex flex-col gap-2">
            <SelectField label="Audio referensi" value={referenceAudioId} onChange={setReferenceAudioId}>
              <option value="">Pilih audio referensi</option>
              {currentMissing && current && (
                <option value={current.id}>
                  {current.originalName} ({current.status === 'ACTIVE' ? 'aktif' : 'arsip'})
                </option>
              )}
              {choices.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.originalName} · versi {item.version} ({formatDuration(item.durationMs)})
                </option>
              ))}
            </SelectField>
            {errors.referenceAudioId && <p className="text-body-s text-feedback-salah">{errors.referenceAudioId}</p>}
            {references.isError && <p className="text-body-s text-text-secondary">Daftar audio referensi gagal dimuat.</p>}
            {current && current.status !== 'ACTIVE' && <p className="text-body-s text-semantic-warning">Audio referensi yang terpasang sudah diarsipkan. Pilih audio referensi yang aktif.</p>}
            <p className="text-body-s text-text-secondary">
              Unggah atau ganti versi audio referensi di halaman{' '}
              <Link to="/admin/audio?kind=REFERENCE" className="text-brand-primary hover:underline">
                Audio
              </Link>
              .
            </p>
            {referenceAudioId && <OnDemandAudioPlayer key={referenceAudioId} fetchUrl={async () => (await adminAudioApi.getUrl(referenceAudioId)).url} label="pratinjau audio referensi" buttonText="Putar pratinjau" />}
          </div>
          <div>
            {/* [ASUMSI] Teks yang ditirukan tampil di halaman Dengar-Tirukan Santri; SDD 4.5.9 tidak menyebut kolomnya. */}
            <label htmlFor={arabicId} className={`flex flex-col gap-1 rounded-sm border-2 bg-neutral-surface px-5 py-3 ${errors.arabicText ? 'border-feedback-salah' : 'border-neutral-border-strong focus-within:border-brand-primary'}`}>
              <span className="text-body-s text-text-muted">Teks Arab yang ditirukan (opsional)</span>
              <textarea id={arabicId} lang="ar" dir="rtl" value={arabicText} rows={2} onChange={(event) => setArabicText(event.target.value)} className="w-full resize-y bg-transparent p-0 font-arabic text-arabic-s text-text-primary outline-none" />
            </label>
            {errors.arabicText && <p className="mt-1 text-body-s text-feedback-salah">{errors.arabicText}</p>}
          </div>
          {/* FR-TASK-04 "Evaluasi otomatis": selalu aktif untuk Dengar-Tirukan, bukan pengaturan. */}
          <p className="rounded-md bg-brand-primary-soft px-5 py-3 text-body-s text-brand-primary">Evaluasi otomatis: rekaman Santri dinilai otomatis oleh sistem dengan membandingkannya dengan audio referensi.</p>
        </>
      )}
      {errors.general && (
        <p className="rounded-md bg-feedback-salah-soft px-5 py-3 text-body-s text-feedback-salah" role="alert">
          {errors.general}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" isLoading={mutations.update.isPending} loadingText="MENYIMPAN…">
          SIMPAN
        </Button>
      </div>
    </form>
  );
}

/** Daftar soal Dengar-Pilih (FR-TASK-01/02). Kunci jawaban ditandai dengan teks, bukan hanya warna. */
function QuestionList({ task, onNotice }: { task: AdminTaskDetail; onNotice: (text: string) => void }): JSX.Element {
  const questions = useTaskQuestions(task.id, true);
  const mutations = useQuestionMutations(task.id);
  const [form, setForm] = useState<{ question?: AdminQuestion } | null>(null);
  const [deleting, setDeleting] = useState<AdminQuestion | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const closeForm = useCallback((saved: boolean) => {
    setForm(null);
    if (!saved) triggerRef.current?.focus();
  }, []);
  const closeDelete = useCallback(() => {
    setDeleting(null);
    setDeleteError(null);
    triggerRef.current?.focus();
  }, []);

  const confirmDelete = () => {
    if (!deleting) return;
    mutations.remove.mutate(deleting.id, {
      onSuccess: () => {
        onNotice('Soal dihapus.');
        setDeleting(null);
      },
      onError: (error) => setDeleteError(error instanceof ApiError ? error.message : 'Soal gagal dihapus. Silakan coba lagi.'),
    });
  };

  return (
    <section className="flex flex-col gap-4" aria-labelledby="question-heading">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="question-heading" className="text-h3">
          Soal {questions.data ? `(${questions.data.length})` : ''}
        </h2>
        <Button
          onClick={(event) => {
            triggerRef.current = event.currentTarget;
            setForm({});
          }}
        >
          TAMBAH SOAL
        </Button>
      </div>
      {questions.isPending ? (
        <ListSkeleton rows={2} />
      ) : questions.isError ? (
        <ErrorState error={questions.error} onRetry={() => void questions.refetch()} backTo="/admin/tugas" backLabel="Kembali ke daftar tugas" />
      ) : questions.data.length === 0 ? (
        <p className="rounded-lg border-2 border-dashed border-neutral-border p-5 text-body text-text-secondary">Belum ada soal. Tugas Dengar-Pilih membutuhkan minimal satu soal sebelum diaktifkan.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {questions.data.map((question, index) => (
            <li key={question.id} className="flex flex-col gap-3 rounded-lg border-2 border-neutral-border bg-neutral-surface p-5 shadow-card">
              <p className="text-body-s text-text-secondary">Soal {index + 1}</p>
              <p className="break-words text-body-l text-text-primary">{question.prompt}</p>
              <p className="break-words text-body-s text-text-secondary">Audio: {question.audio ? question.audio.originalName : 'tidak ditemukan'}</p>
              {question.audio && <OnDemandAudioPlayer fetchUrl={async () => (await adminAudioApi.getUrl(question.audioId)).url} label={`audio soal ${index + 1}`} buttonText="Putar" />}
              <ul className="flex flex-col gap-2" aria-label={`Pilihan jawaban soal ${index + 1}`}>
                {question.options.map((option) => (
                  <li key={option.id} className={`flex flex-wrap items-center gap-3 rounded-md border px-4 py-2 ${option.isCorrect ? 'border-feedback-benar bg-feedback-benar-soft' : 'border-neutral-border'}`}>
                    {option.arabicLabel && (
                      <span lang="ar" dir="rtl" className="font-arabic text-arabic-s">
                        {option.arabicLabel}
                      </span>
                    )}
                    <span className="text-body">{option.label}</span>
                    {option.isCorrect && <span className="text-label text-feedback-benar">JAWABAN BENAR</span>}
                  </li>
                ))}
              </ul>
              <div className="-mx-3 flex flex-wrap">
                <button
                  type="button"
                  className={textButton}
                  onClick={(event) => {
                    triggerRef.current = event.currentTarget;
                    setForm({ question });
                  }}
                  aria-label={`Ubah soal ${index + 1}`}
                >
                  Ubah
                </button>
                <button
                  type="button"
                  className={`${textButton} text-feedback-salah`}
                  onClick={(event) => {
                    triggerRef.current = event.currentTarget;
                    setDeleting(question);
                  }}
                  aria-label={`Hapus soal ${index + 1}`}
                >
                  Hapus
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {form && (
        <QuestionFormDialog
          initial={form.question}
          onSubmit={async (input) => {
            if (form.question) await mutations.update.mutateAsync({ id: form.question.id, input });
            else await mutations.create.mutateAsync(input);
            onNotice(form.question ? 'Soal tersimpan.' : 'Soal ditambahkan.');
          }}
          onClose={closeForm}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Hapus soal?"
          message="Soal ini akan dihapus dari tugas. Riwayat pengerjaan lama tetap tersimpan."
          confirmLabel="HAPUS"
          pending={mutations.remove.isPending}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={closeDelete}
        />
      )}
    </section>
  );
}

// Penyunting Tugas (SDD 5.17, 3.7.3; UI-ADMIN-TASK-02/03, UI-ADMIN-QUESTION-01/02).
// [ASUMSI] SDD 7.7 tidak punya bagian UI tugas dan tidak ada desain Figma admin.
export function TaskEditorPage(): JSX.Element {
  const { taskId = '' } = useParams();
  const task = useAdminTask(taskId);
  const navigate = useNavigate();
  const mutations = useTaskMutations();
  const notice = useContentNotice();
  const [missing, setMissing] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  if (task.isPending) return <ListSkeleton rows={4} />;
  if (task.isError) return <ErrorState error={task.error} onRetry={() => void task.refetch()} backTo="/admin/tugas" backLabel="Kembali ke daftar tugas" />;
  const data = task.data;
  const backTo = `/admin/tugas?stageId=${encodeURIComponent(data.stageId)}&materialId=${encodeURIComponent(data.materialId)}`;

  const success = (text: string) => {
    setMissing([]);
    notice.success(text);
  };

  const onAction = (action: ContentAction, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    notice.clear();
    setMissing([]);
    const request = statusRequest(action);
    if (request.kind === 'delete') {
      setDeleting(true);
      return;
    }
    const onError = (error: unknown) => {
      // 422 TASK_INCOMPLETE: daftar komponen yang belum lengkap (SDD 3.7.3).
      const details = error instanceof ApiError && error.code === 'TASK_INCOMPLETE' && Array.isArray(error.details) ? (error.details as { message?: string }[]) : [];
      setMissing(details.map((item) => item.message ?? '').filter(Boolean));
      notice.failure(error);
    };
    const onSettled = () => triggerRef.current?.focus();
    if (request.kind === 'publish') mutations.publish.mutate(data.id, { onSuccess: () => success('Tugas diaktifkan.'), onError, onSettled });
    else mutations.update.mutate({ id: data.id, input: request.input }, { onSuccess: (saved) => success(`Status tugas menjadi ${STATUS_LABEL[saved.status]}.`), onError, onSettled });
  };

  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-6">
      <Link to={backTo} className="flex min-h-11 w-fit items-center text-body text-brand-primary hover:underline">
        ← Kembali ke daftar tugas
      </Link>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-body-s text-text-secondary">{TYPE_LABEL[data.type]}</span>
          <ContentStatusPill status={data.status} />
        </div>
        <h1 className="break-words text-h2">{data.title}</h1>
        <p className="break-words text-body-s text-text-secondary">
          {data.stageTitle} · {data.materialTitle}
        </p>
        <ContentStatusActions status={data.status} isReferenced={data.isReferenced} name={data.title} disabled={mutations.update.isPending || mutations.publish.isPending} onAction={onAction} />
      </div>
      {notice.element}
      {missing.length > 0 && (
        <ul className="list-disc rounded-md bg-feedback-salah-soft py-3 pl-10 pr-5 text-body-s text-feedback-salah">
          {missing.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}
      <TaskSettingsForm key={data.id} task={data} onSaved={success} />
      {data.type === 'QUIZ' && <QuestionList task={data} onNotice={success} />}
      {deleting && (
        <ConfirmDialog
          title="Hapus tugas?"
          message={`Apakah Anda yakin ingin menghapus "${data.title}"? Tindakan ini tidak dapat dibatalkan.`}
          confirmLabel="HAPUS"
          pending={mutations.remove.isPending}
          error={deleteError}
          onConfirm={() =>
            mutations.remove.mutate(data.id, {
              onSuccess: () => navigate(backTo, { replace: true }),
              onError: (error) => setDeleteError(error instanceof ApiError ? error.message : 'Data gagal dihapus. Silakan coba lagi.'),
            })
          }
          onClose={() => {
            setDeleting(false);
            setDeleteError(null);
            triggerRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}
