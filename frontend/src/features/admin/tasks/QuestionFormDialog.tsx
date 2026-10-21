import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { OnDemandAudioPlayer } from '../../../components/audio/OnDemandAudioPlayer';
import { Button } from '../../../components/ui/Button';
import { SelectField } from '../../../components/ui/SelectField';
import { TextField } from '../../../components/ui/TextField';
import { ApiError } from '../../../lib/api/ApiError';
import { adminContentApi } from '../content/api';
import { useLearningAudio } from '../content/hooks';
import type { AdminQuestion, QuestionInput } from './types';
import { OPTIONS_MAX, OPTIONS_MIN, validateQuestion, type QuestionErrors } from './view';

type OptionDraft = QuestionInput['options'][number];

interface QuestionFormDialogProps {
  /** Ada = ubah soal ini; tidak ada = soal baru. */
  initial?: AdminQuestion;
  onSubmit: (input: QuestionInput) => Promise<unknown>;
  onClose: (saved: boolean) => void;
}

const emptyOption = (): OptionDraft => ({ label: '', arabicLabel: '', isCorrect: false });

const textButton =
  'min-h-11 rounded-md px-3 text-body text-brand-primary hover:bg-neutral-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:text-text-muted';

/** Form soal Dengar-Pilih (SDD 5.17, UI-ADMIN-QUESTION-01/02, FR-TASK-01/02) dalam <dialog>. */
export function QuestionFormDialog({ initial, onSubmit, onClose }: QuestionFormDialogProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const savedRef = useRef(false);
  const titleId = useId();
  const promptId = useId();
  const audio = useLearningAudio();
  const [prompt, setPrompt] = useState(initial?.prompt ?? '');
  const [audioId, setAudioId] = useState(initial?.audioId ?? '');
  const [options, setOptions] = useState<OptionDraft[]>(
    initial ? initial.options.map(({ label, arabicLabel, isCorrect }) => ({ label, arabicLabel, isCorrect })) : [emptyOption(), emptyOption()],
  );
  const [errors, setErrors] = useState<QuestionErrors & { general?: string }>({ optionLabels: {} });
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

  const setOption = (index: number, patch: Partial<OptionDraft>) => setOptions((list) => list.map((option, i) => (i === index ? { ...option, ...patch } : option)));
  const markCorrect = (index: number) => setOptions((list) => list.map((option, i) => ({ ...option, isCorrect: i === index })));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const input: QuestionInput = { prompt: prompt.trim(), audioId, options: options.map((option) => ({ ...option, label: option.label.trim(), arabicLabel: option.arabicLabel.trim() })) };
    const invalid = validateQuestion(input);
    setErrors(invalid ?? { optionLabels: {} });
    if (invalid) return;
    setPending(true);
    try {
      await onSubmit(input);
      savedRef.current = true;
      dialogRef.current?.close();
    } catch (error) {
      const details = error instanceof ApiError && Array.isArray(error.details) ? (error.details as { field?: string; message?: string }[]) : [];
      const fieldError = (name: string) => details.find((item) => item.field === name)?.message;
      const optionLabels: Record<number, string> = {};
      for (const item of details) {
        const match = item.field?.match(/^options\.(\d+)\.label$/);
        if (match && item.message) optionLabels[Number(match[1])] = item.message;
      }
      setErrors({
        prompt: fieldError('prompt'),
        audioId: fieldError('audioId'),
        options: fieldError('options') ?? (error instanceof ApiError && error.code === 'TASK_ANSWER_KEY_INVALID' ? error.message : undefined),
        optionLabels,
        general: details.length === 0 && !(error instanceof ApiError && error.code === 'TASK_ANSWER_KEY_INVALID') ? (error instanceof ApiError ? error.message : 'Soal gagal disimpan. Silakan coba lagi.') : undefined,
      });
    } finally {
      setPending(false);
    }
  };

  const audioChoices = audio.data?.filter((item) => item.status === 'ACTIVE' || item.id === audioId) ?? [];

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} className="w-[calc(100%-2rem)] max-w-[640px] rounded-lg border-0 bg-neutral-surface p-0 text-text-primary shadow-raised backdrop:bg-text-primary/40">
      <form className="flex flex-col gap-5 p-6" onSubmit={(event) => void submit(event)} noValidate>
        <h2 id={titleId} className="text-h2">
          {initial ? 'Ubah soal' : 'Tambah soal'}
        </h2>
        {initial && <p className="text-body-s text-text-secondary">Riwayat pengerjaan lama tetap memakai isi soal saat dikerjakan.</p>}
        <div>
          <label htmlFor={promptId} className={`flex flex-col gap-1 rounded-sm border-2 bg-neutral-surface px-5 py-3 ${errors.prompt ? 'border-feedback-salah' : 'border-neutral-border-strong focus-within:border-brand-primary'}`}>
            <span className="text-body-s text-text-muted">Pertanyaan</span>
            <textarea id={promptId} value={prompt} rows={2} onChange={(event) => setPrompt(event.target.value)} className="w-full resize-y bg-transparent p-0 text-body text-text-primary outline-none" autoFocus />
          </label>
          {errors.prompt && <p className="mt-1 text-body-s text-feedback-salah">{errors.prompt}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <SelectField label="Audio soal" value={audioId} onChange={setAudioId}>
            <option value="">Pilih audio</option>
            {audioChoices.map((item) => (
              <option key={item.id} value={item.id}>
                {item.originalName}
                {item.status !== 'ACTIVE' ? ' (arsip)' : ''}
              </option>
            ))}
          </SelectField>
          {errors.audioId && <p className="text-body-s text-feedback-salah">{errors.audioId}</p>}
          {audio.isError && <p className="text-body-s text-text-secondary">Daftar audio gagal dimuat.</p>}
          {audioId && <OnDemandAudioPlayer key={audioId} fetchUrl={async () => (await adminContentApi.getAudioUrl(audioId)).url} label="pratinjau audio soal" buttonText="Putar pratinjau" />}
        </div>
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 text-body font-semibold">Pilihan jawaban</legend>
          {options.map((option, index) => (
            <div key={index} className="flex flex-col gap-3 rounded-md border border-neutral-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex min-h-11 items-center gap-3 text-body">
                  <input type="radio" name="correct-option" checked={option.isCorrect} onChange={() => markCorrect(index)} className="h-5 w-5 accent-brand-primary" />
                  Jawaban benar
                </label>
                <button
                  type="button"
                  className={textButton}
                  disabled={options.length <= OPTIONS_MIN}
                  onClick={() => setOptions((list) => list.filter((_, i) => i !== index))}
                  aria-label={`Hapus pilihan ${index + 1}`}
                >
                  Hapus
                </button>
              </div>
              <TextField label={`Pilihan ${index + 1}`} value={option.label} maxLength={255} onChange={(event) => setOption(index, { label: event.target.value })} error={errors.optionLabels[index]} />
              <TextField label={`Teks Arab pilihan ${index + 1} (opsional)`} value={option.arabicLabel} maxLength={255} lang="ar" dir="rtl" onChange={(event) => setOption(index, { arabicLabel: event.target.value })} />
            </div>
          ))}
          {errors.options && (
            <p className="text-body-s text-feedback-salah" role="alert">
              {errors.options}
            </p>
          )}
          <div className="-mx-3">
            <button type="button" className={textButton} disabled={options.length >= OPTIONS_MAX} onClick={() => setOptions((list) => [...list, emptyOption()])}>
              Tambah pilihan
            </button>
          </div>
        </fieldset>
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
