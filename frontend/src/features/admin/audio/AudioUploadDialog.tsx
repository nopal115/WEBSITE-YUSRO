import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { SelectField } from '../../../components/ui/SelectField';
import { ApiError } from '../../../lib/api/ApiError';
import type { AdminAudio, AudioKind } from './types';
import { KIND_LABEL, validateAudioFile } from './view';

interface AudioUploadDialogProps {
  /** Ada = Ganti Versi audio ini; tidak ada = unggah audio baru. */
  replacing?: AdminAudio;
  onSubmit: (values: { file: File; kind: AudioKind }) => Promise<unknown>;
  onClose: (saved: boolean) => void;
}

/** Unggah audio baru atau Ganti Versi (SDD 5.16, 7.7.19) dalam <dialog>. Galat per kolom dari server tampil di kolomnya. */
export function AudioUploadDialog({ replacing, onSubmit, onClose }: AudioUploadDialogProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const savedRef = useRef(false);
  const titleId = useId();
  const fileId = useId();
  const [kind, setKind] = useState<AudioKind>(replacing?.kind ?? 'LEARNING');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ file?: string; kind?: string; general?: string }>({});
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
    const fileError = validateAudioFile(file);
    setErrors({ file: fileError ?? undefined });
    if (fileError || !file) return;
    setPending(true);
    try {
      await onSubmit({ file, kind });
      savedRef.current = true;
      dialogRef.current?.close();
    } catch (error) {
      const details = error instanceof ApiError && Array.isArray(error.details) ? (error.details as { field?: string; message?: string }[]) : [];
      const fieldError = (name: string) => details.find((item) => item.field === name)?.message;
      setErrors({
        file: fieldError('file'),
        kind: fieldError('kind'),
        general: details.length === 0 ? (error instanceof ApiError ? error.message : 'Audio gagal diunggah. Silakan coba lagi.') : undefined,
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} className="w-[calc(100%-2rem)] max-w-[520px] rounded-lg border-0 bg-neutral-surface p-0 text-text-primary shadow-raised backdrop:bg-text-primary/40">
      <form className="flex flex-col gap-5 p-6" onSubmit={(event) => void submit(event)} noValidate>
        <h2 id={titleId} className="text-h2">
          {replacing ? 'Ganti versi audio' : 'Unggah audio'}
        </h2>
        {replacing ? (
          <p className="break-words text-body-s text-text-secondary">
            Versi {replacing.version} (<span className="font-semibold text-text-primary">{replacing.originalName}</span>) akan diarsipkan dan tetap tercatat pada submission lama. Versi baru dipakai untuk submission berikutnya.
          </p>
        ) : (
          <div>
            <SelectField label="Jenis audio" value={kind} onChange={(value) => setKind(value as AudioKind)}>
              <option value="LEARNING">{KIND_LABEL.LEARNING}</option>
              <option value="REFERENCE">{KIND_LABEL.REFERENCE}</option>
            </SelectField>
            {errors.kind && <p className="mt-1 text-body-s text-feedback-salah">{errors.kind}</p>}
          </div>
        )}
        <div>
          <label htmlFor={fileId} className={`flex flex-col gap-2 rounded-sm border-2 bg-neutral-surface px-5 py-3 ${errors.file ? 'border-feedback-salah' : 'border-neutral-border-strong focus-within:border-brand-primary'}`}>
            <span className="text-body-s text-text-muted">Berkas audio (maksimal 12 MB)</span>
            <input
              id={fileId}
              type="file"
              accept="audio/*"
              aria-invalid={errors.file ? true : undefined}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="min-h-11 w-full text-body text-text-primary file:mr-4 file:min-h-11 file:rounded-md file:border-0 file:bg-brand-primary-soft file:px-4 file:text-body file:text-brand-primary"
            />
          </label>
          {errors.file && <p className="mt-1 text-body-s text-feedback-salah">{errors.file}</p>}
        </div>
        {errors.general && (
          <p className="rounded-md bg-feedback-salah-soft px-5 py-3 text-body-s text-feedback-salah" role="alert">
            {errors.general}
          </p>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => dialogRef.current?.close()} disabled={pending}>
            BATAL
          </Button>
          <Button type="submit" isLoading={pending} loadingText="MENGUNGGAH…">
            {replacing ? 'GANTI VERSI' : 'UNGGAH'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
