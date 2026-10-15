import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { TextField } from '../../../components/ui/TextField';
import { ApiError } from '../../../lib/api/ApiError';

export interface ContentFormValues {
  title: string;
  description: string;
  isRequired: boolean;
}

interface ContentFormDialogProps {
  kind: 'stage' | 'material';
  /** Ada = ubah; tidak ada = tambah. */
  initial?: ContentFormValues & { code: string };
  onSubmit: (values: { title: string; description: string | null; isRequired: boolean }) => Promise<unknown>;
  onClose: (saved: boolean) => void;
}

// Batas panjang kolom SDD 4.5.5/4.5.6: judul tahapan 150, judul materi 200.
const TITLE_MAX = { stage: 150, material: 200 };
const DESCRIPTION_MAX = 2000;

/**
 * Form tambah/ubah tahapan atau materi dalam <dialog>. Kode dibuat server dan tampil sebagai teks tetap
 * ([ASUMSI] Q4 A4). Galat per kolom dari server (errors[]) ditampilkan di bawah kolomnya.
 */
export function ContentFormDialog({ kind, initial, onSubmit, onClose }: ContentFormDialogProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const savedRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [isRequired, setIsRequired] = useState(initial?.isRequired ?? true);
  const [errors, setErrors] = useState<{ title?: string; description?: string; general?: string }>({});
  const [pending, setPending] = useState(false);
  const noun = kind === 'stage' ? 'tahapan' : 'materi';

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
    const next: typeof errors = {};
    if (!trimmed) next.title = 'Judul wajib diisi.';
    else if (trimmed.length > TITLE_MAX[kind]) next.title = `Judul maksimal ${TITLE_MAX[kind]} karakter.`;
    if (description.length > DESCRIPTION_MAX) next.description = `Maksimal ${DESCRIPTION_MAX} karakter.`;
    setErrors(next);
    if (next.title || next.description) return;
    setPending(true);
    try {
      await onSubmit({ title: trimmed, description: description.trim() || null, isRequired });
      savedRef.current = true;
      dialogRef.current?.close();
    } catch (error) {
      const details = error instanceof ApiError && Array.isArray(error.details) ? (error.details as { field?: string; message?: string }[]) : [];
      const fieldError = (name: string) => details.find((item) => item.field === name)?.message;
      setErrors({
        title: fieldError('title'),
        description: fieldError('description') ?? fieldError('summary'),
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
          {initial ? `Ubah ${noun}` : `Tambah ${noun}`}
        </h2>
        {initial && (
          <p className="text-body-s text-text-secondary">
            Kode <span className="font-semibold text-text-primary">{initial.code}</span> (tidak dapat diubah)
          </p>
        )}
        <TextField label="Judul" value={title} maxLength={TITLE_MAX[kind]} onChange={(event) => setTitle(event.target.value)} error={errors.title} autoFocus />
        <div>
          <label htmlFor={descriptionId} className={`flex flex-col gap-1 rounded-sm border-2 bg-neutral-surface px-5 py-3 ${errors.description ? 'border-feedback-salah' : 'border-neutral-border-strong focus-within:border-brand-primary'}`}>
            <span className="text-body-s text-text-muted">{kind === 'stage' ? 'Deskripsi (opsional)' : 'Ringkasan (opsional)'}</span>
            <textarea id={descriptionId} value={description} rows={3} onChange={(event) => setDescription(event.target.value)} className="w-full resize-y bg-transparent p-0 text-body text-text-primary outline-none" />
          </label>
          {errors.description && <p className="mt-1 text-body-s text-feedback-salah">{errors.description}</p>}
        </div>
        {kind === 'material' && (
          // FR-LEARN-07: materi wajib menjadi dasar pembukaan tahapan berikutnya.
          <label className="flex min-h-11 items-start gap-3 text-body text-text-primary">
            <input type="checkbox" checked={isRequired} onChange={(event) => setIsRequired(event.target.checked)} className="mt-1 h-5 w-5 accent-brand-primary" />
            <span>
              Materi wajib
              <span className="block text-body-s text-text-secondary">Materi wajib harus diselesaikan untuk membuka tahapan berikutnya.</span>
            </span>
          </label>
        )}
        {!initial && <p className="text-body-s text-text-secondary">Konten baru berstatus DRAFT dan belum terlihat oleh Santri sampai diaktifkan.</p>}
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
