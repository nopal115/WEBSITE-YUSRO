import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/api/ApiError';
import { RecordingPlayer } from './RecordingPlayer';
import { useGradeSubmission } from './hooks';
import type { AdminSubmission } from './types';

interface GradeModalProps {
  submission: AdminSubmission;
  onClose: () => void;
  onSuccess: (updated: AdminSubmission) => void;
}

export function GradeModal({ submission, onClose, onSuccess }: GradeModalProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const gradeMutation = useGradeSubmission();

  const [score, setScore] = useState<string>(
    submission.score !== null ? String(submission.score) : '85',
  );
  const [feedbackCategory, setFeedbackCategory] = useState<string>(
    submission.feedbackCategory || 'BAIK',
  );
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

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

  const handleScoreChange = (val: string) => {
    setScore(val);
    const num = Number(val);
    if (!isNaN(num)) {
      if (num >= 90) setFeedbackCategory('SANGAT_BAIK');
      else if (num >= 80) setFeedbackCategory('BAIK');
      else if (num >= 70) setFeedbackCategory('CUKUP');
      else setFeedbackCategory('PERLU_LATIHAN');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const numericScore = Number(score);
    if (isNaN(numericScore) || numericScore < 0 || numericScore > 100) {
      setError('Nilai harus berupa angka antara 0 sampai 100');
      return;
    }

    gradeMutation.mutate(
      {
        submissionId: submission.submissionId,
        score: numericScore,
        feedbackCategory,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: (updated) => {
          onSuccess(updated);
          dialogRef.current?.close();
        },
        onError: (err) => {
          setError(err instanceof ApiError ? err.message : 'Gagal menyimpan nilai. Coba lagi.');
        },
      },
    );
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="w-[calc(100%-2rem)] max-w-[520px] rounded-xl border border-neutral-border bg-neutral-surface p-0 text-text-primary shadow-raised backdrop:bg-text-primary/40"
    >
      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-border p-5">
          <h2 id={titleId} className="text-h3 text-text-primary">
            Penilaian Rekaman Santri
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-md p-1.5 text-text-secondary hover:bg-neutral-surface-alt"
            aria-label="Tutup"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-5">
          {/* Detail Santri & Tugas */}
          <div className="rounded-lg bg-neutral-surface-alt p-4 text-body-s flex flex-col gap-2 border border-neutral-border">
            <div className="flex justify-between">
              <span className="text-text-secondary">Santri:</span>
              <span className="font-semibold text-text-primary">
                {submission.studentName} ({submission.studentCode || '—'})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Tugas / Materi:</span>
              <span className="font-semibold text-text-primary">
                {submission.taskTitle} {submission.materialTitle ? `(${submission.materialTitle})` : ''}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Percobaan:</span>
              <span className="text-text-primary">Ke-{submission.attemptNo}</span>
            </div>
          </div>

          {/* Player Rekaman */}
          <div className="flex flex-col gap-2">
            <label className="text-label text-text-secondary font-medium">
              REKAMAN SUARA SANTRI
            </label>
            <div className="rounded-lg border border-neutral-border bg-neutral-surface p-3 flex items-center justify-between">
              <span className="text-body-s text-text-secondary">Dengarkan pelafalan:</span>
              <RecordingPlayer
                submissionId={submission.submissionId}
                label={`rekaman ${submission.studentName}`}
              />
            </div>
          </div>

          {/* Form Input Nilai */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="score-input" className="text-label text-text-secondary font-medium">
                NILAI ANGKA (0 - 100) *
              </label>
              <input
                id="score-input"
                type="number"
                min="0"
                max="100"
                required
                value={score}
                onChange={(e) => handleScoreChange(e.target.value)}
                className="h-11 rounded-md border border-neutral-border bg-neutral-surface px-3 text-body font-semibold text-text-primary focus:border-brand-primary focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="category-select" className="text-label text-text-secondary font-medium">
                PREDIKAT / HASIL *
              </label>
              <select
                id="category-select"
                value={feedbackCategory}
                onChange={(e) => setFeedbackCategory(e.target.value)}
                className="h-11 rounded-md border border-neutral-border bg-neutral-surface px-3 text-body text-text-primary focus:border-brand-primary focus:outline-none"
              >
                <option value="SANGAT_BAIK">Sangat Baik (Mumtaz)</option>
                <option value="BAIK">Baik (Jayyid)</option>
                <option value="CUKUP">Cukup (Maqbul)</option>
                <option value="PERLU_LATIHAN">Perlu Latihan Lagi</option>
              </select>
            </div>
          </div>

          {/* Catatan / Feedback Ustadz */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="notes-input" className="text-label text-text-secondary font-medium">
              CATATAN / MASUKAN UNTUK SANTRI (OPSIONAL)
            </label>
            <textarea
              id="notes-input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Makhraj huruf sudah fasih, teruskan latihannya!"
              className="rounded-md border border-neutral-border bg-neutral-surface p-3 text-body text-text-primary focus:border-brand-primary focus:outline-none resize-none"
            />
          </div>

          {error && (
            <p className="rounded-md bg-feedback-salah-soft px-4 py-2.5 text-body-s text-feedback-salah" role="alert">
              {error}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t border-neutral-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => dialogRef.current?.close()}
              disabled={gradeMutation.isPending}
            >
              BATAL
            </Button>
            <Button
              type="submit"
              variant="accent"
              isLoading={gradeMutation.isPending}
              loadingText="MENYIMPAN…"
            >
              SIMPAN NILAI
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
