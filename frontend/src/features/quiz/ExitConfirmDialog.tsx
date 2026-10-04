import { useEffect, useRef, type RefObject } from 'react';
import { Button } from '../../components/ui/Button';

interface ExitConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** Tombol pembuka; fokus kembali ke sini saat dialog dibatalkan. */
  returnFocusRef: RefObject<HTMLElement>;
}

/** Konfirmasi keluar saat ada jawaban belum terkirim. <dialog> bawaan: modal, Esc membatalkan. */
export function ExitConfirmDialog({ open, onCancel, onConfirm, returnFocusRef }: ExitConfirmDialogProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Esc memicu cancel lalu close; keduanya berarti batal.
    const handleClose = (): void => {
      onCancel();
      returnFocusRef.current?.focus();
    };
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onCancel, returnFocusRef]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="keluar-judul"
      aria-describedby="keluar-isi"
      className="w-[calc(100%-2rem)] max-w-[440px] rounded-lg border-0 bg-neutral-surface p-0 text-text-primary shadow-raised backdrop:bg-text-primary/40"
    >
      <div className="flex flex-col gap-5 p-6">
        <h2 id="keluar-judul" className="text-h2">
          Keluar dari latihan?
        </h2>
        <p id="keluar-isi" className="text-body text-text-secondary">
          Jawaban belum dikirim dan akan hilang jika Anda keluar. Tetap keluar?
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => dialogRef.current?.close()}>
            BATAL
          </Button>
          <Button variant="salah" onClick={onConfirm}>
            KELUAR
          </Button>
        </div>
      </div>
    </dialog>
  );
}
