import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/api/ApiError';
import type { AccountStatus } from '../../auth/types';
import { useUpdateStudentStatus } from './hooks';

const MAX_REASON = 255;

export interface StatusTarget {
  id: string;
  name: string;
  status: AccountStatus;
}

interface StudentStatusDialogProps {
  student: StatusTarget;
  /** Dipanggil saat dialog tertutup; berisi status baru bila perubahan berhasil. */
  onClose: (changedTo: AccountStatus | null) => void;
}

/**
 * Konfirmasi ubah status akun (SDD 7.7.17, UI-ADMIN-STUDENT-04). <dialog> bawaan: modal, Esc membatalkan.
 * Dipasang saat dibuka dan dilepas saat ditutup, sehingga isian alasan selalu mulai kosong.
 * [REKOMENDASI] Teks dialog; tidak ada desain Figma untuk admin.
 */
export function StudentStatusDialog({ student, onClose }: StudentStatusDialogProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const changedRef = useRef<AccountStatus | null>(null);
  const [reason, setReason] = useState('');
  const mutation = useUpdateStudentStatus();
  const titleId = useId();
  const bodyId = useId();
  const reasonId = useId();
  const deactivate = student.status === 'ACTIVE';
  const nextStatus: AccountStatus = deactivate ? 'INACTIVE' : 'ACTIVE';

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose(changedRef.current);
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = reason.trim();
    mutation.mutate(
      { id: student.id, input: { status: nextStatus, ...(trimmed ? { reason: trimmed } : {}) } },
      {
        onSuccess: () => {
          changedRef.current = nextStatus;
          dialogRef.current?.close();
        },
      },
    );
  };

  const error = mutation.error;
  const fieldErrors = error instanceof ApiError && Array.isArray(error.details) ? (error.details as { field?: string; message?: string }[]) : [];
  const reasonError = fieldErrors.find((item) => item.field === 'reason')?.message;
  const generalError = error && !reasonError ? (error instanceof ApiError ? error.message : 'Terjadi kesalahan. Coba lagi.') : null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      className="w-[calc(100%-2rem)] max-w-[480px] rounded-lg border-0 bg-neutral-surface p-0 text-text-primary shadow-raised backdrop:bg-text-primary/40"
    >
      <form className="flex flex-col gap-5 p-6" onSubmit={submit} noValidate>
        <h2 id={titleId} className="text-h2">
          {deactivate ? `Nonaktifkan akun ${student.name}?` : `Aktifkan kembali akun ${student.name}?`}
        </h2>
        <p id={bodyId} className="text-body text-text-secondary">
          {deactivate
            ? `${student.name} tidak dapat masuk sampai akunnya diaktifkan kembali. Data pembelajarannya tetap tersimpan.`
            : `${student.name} dapat masuk kembali. Data pembelajarannya tetap seperti sebelumnya.`}
        </p>
        <div>
          <label
            htmlFor={reasonId}
            className={`flex flex-col gap-1 rounded-sm border-2 bg-neutral-surface px-5 py-3 ${reasonError ? 'border-feedback-salah' : 'border-neutral-border-strong focus-within:border-brand-primary'}`}
          >
            <span className="text-body-s text-text-muted">Alasan (opsional)</span>
            {/* [ASUMSI] Batas 255 karakter; SDD 5.14 hanya menyebut alasan bersifat opsional. */}
            <textarea
              id={reasonId}
              value={reason}
              maxLength={MAX_REASON}
              rows={3}
              onChange={(event) => setReason(event.target.value)}
              aria-invalid={reasonError ? true : undefined}
              aria-describedby={`${reasonId}-hint`}
              className="w-full resize-y bg-transparent p-0 text-body text-text-primary outline-none"
            />
          </label>
          <p id={`${reasonId}-hint`} className={`mt-1 text-body-s ${reasonError ? 'text-feedback-salah' : 'text-text-secondary'}`}>
            {reasonError ?? `${reason.length}/${MAX_REASON} karakter`}
          </p>
        </div>
        {generalError && (
          <p className="rounded-md bg-feedback-salah-soft px-5 py-3 text-body-s text-feedback-salah" role="alert">
            {generalError}
          </p>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => dialogRef.current?.close()} disabled={mutation.isPending}>
            BATAL
          </Button>
          <Button type="submit" variant={deactivate ? 'salah' : 'primary'} isLoading={mutation.isPending} loadingText="MENYIMPAN…">
            {deactivate ? 'NONAKTIFKAN' : 'AKTIFKAN'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
