import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { SelectField } from '../../../components/ui/SelectField';
import { TextField } from '../../../components/ui/TextField';
import { ApiError } from '../../../lib/api/ApiError';
import type { TaskType } from './types';
import { TITLE_MAX, TYPE_LABEL } from './view';

interface TaskCreateDialogProps {
  materialTitle: string;
  onSubmit: (values: { type: TaskType; title: string }) => Promise<unknown>;
  onClose: (saved: boolean) => void;
}

/** Tambah tugas (SDD 5.17, UI-ADMIN-TASK-01): jenis + judul; komponen lain diatur di penyunting tugas. */
export function TaskCreateDialog({ materialTitle, onSubmit, onClose }: TaskCreateDialogProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const savedRef = useRef(false);
  const titleId = useId();
  const [type, setType] = useState<TaskType>('QUIZ');
  const [title, setTitle] = useState('');
  const [errors, setErrors] = useState<{ title?: string; general?: string }>({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose(savedRef.current);
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setErrors({ title: 'Judul wajib diisi.' });
      return;
    }
    setPending(true);
    try {
      await onSubmit({ type, title: trimmed });
      savedRef.current = true;
      dialogRef.current?.close();
    } catch (error) {
      const details = error instanceof ApiError && Array.isArray(error.details) ? (error.details as { field?: string; message?: string }[]) : [];
      setErrors({
        title: details.find((item) => item.field === 'title')?.message,
        general: details.length === 0 ? (error instanceof ApiError ? error.message : 'Data gagal disimpan. Silakan coba lagi.') : undefined,
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} className="w-[calc(100%-2rem)] max-w-[520px] rounded-lg border-0 bg-neutral-surface p-0 text-text-primary shadow-raised backdrop:bg-text-primary/40">
      <form className="flex flex-col gap-5 p-6" onSubmit={(event) => void submit(event)} noValidate>
        <h2 id={titleId} className="text-h2">
          Tambah tugas
        </h2>
        <p className="break-words text-body-s text-text-secondary">
          Materi: <span className="font-semibold text-text-primary">{materialTitle}</span>
        </p>
        <SelectField label="Jenis tugas" value={type} onChange={(value) => setType(value as TaskType)}>
          <option value="QUIZ">{TYPE_LABEL.QUIZ}</option>
          <option value="IMITATION">{TYPE_LABEL.IMITATION}</option>
        </SelectField>
        <TextField label="Judul" value={title} maxLength={TITLE_MAX} onChange={(event) => setTitle(event.target.value)} error={errors.title} autoFocus />
        <p className="text-body-s text-text-secondary">Tugas baru berstatus DRAFT. Soal atau audio referensi diatur setelah tugas dibuat.</p>
        {errors.general && (
          <p className="rounded-md bg-feedback-salah-soft px-5 py-3 text-body-s text-feedback-salah" role="alert">
            {errors.general}
          </p>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => dialogRef.current?.close()} disabled={pending}>
            BATAL
          </Button>
          <Button type="submit" isLoading={pending} loadingText="MENYIMPAN…">
            SIMPAN
          </Button>
        </div>
      </form>
    </dialog>
  );
}
