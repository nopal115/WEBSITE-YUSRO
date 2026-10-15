import { useEffect, useId, useRef } from 'react';
import { Button, type ButtonVariant } from './Button';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  pending?: boolean;
  /** Pesan galat server, ditampilkan di dalam dialog. */
  error?: string | null;
  onConfirm: () => void;
  /** Dipanggil saat dialog tertutup (BATAL, Esc, atau setelah pemanggil menutupnya). */
  onClose: () => void;
}

/**
 * Konfirmasi tindakan yang tidak dapat dibatalkan, mis. hapus (SRS BR-DELETE-01). <dialog> bawaan: modal,
 * Esc membatalkan. Dipasang saat dibuka dan dilepas saat ditutup oleh pemanggil.
 */
export function ConfirmDialog({ title, message, confirmLabel, confirmVariant = 'salah', pending = false, error = null, onConfirm, onClose }: ConfirmDialogProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.addEventListener('close', onClose);
    return () => dialog.removeEventListener('close', onClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      className="w-[calc(100%-2rem)] max-w-[440px] rounded-lg border-0 bg-neutral-surface p-0 text-text-primary shadow-raised backdrop:bg-text-primary/40"
    >
      <div className="flex flex-col gap-5 p-6">
        <h2 id={titleId} className="text-h2">
          {title}
        </h2>
        <p id={bodyId} className="text-body text-text-secondary">
          {message}
        </p>
        {error && (
          <p className="rounded-md bg-feedback-salah-soft px-5 py-3 text-body-s text-feedback-salah" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => dialogRef.current?.close()} disabled={pending}>
            BATAL
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} isLoading={pending} loadingText="MEMPROSES…">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
