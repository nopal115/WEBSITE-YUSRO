import { X } from 'lucide-react';
import { useCallback, useRef, useState, type ReactNode, type Ref } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AudioPlayer } from '../../components/audio/AudioPlayer';
import { Button } from '../../components/ui/Button';
import { LetterCard } from '../../components/ui/LetterCard';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { ApiError } from '../../lib/api/ApiError';
import { ErrorState } from '../learning/QueryStates';
import { ExitConfirmDialog } from './ExitConfirmDialog';
import { useQuizTask, useSubmitQuiz } from './hooks';
import { ArabicOption, QuizResultView } from './QuizResultView';
import { allAnswered, buildSubmitInput, nextStep, previousStep, sortQuestions, type Answers, type QuizStep } from './session';
import type { QuizTask } from './types';

/** Keluar: kembali ke halaman sebelumnya, atau ke /belajar bila tidak ada riwayat. */
function useExit(): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (historyIndex > 0) navigate(-1);
    else navigate('/belajar');
  }, [navigate]);
}

/** Kerangka layar latihan: header tetap (X, progress, indikator) dan isi terpusat. */
function QuizFrame({ indicator, value, max, onExit, exitRef, children }: { indicator: string; value: number; max: number; onExit: () => void; exitRef?: Ref<HTMLButtonElement>; children: ReactNode }): JSX.Element {
  return (
    <div className="min-h-screen bg-neutral-surface-alt pb-16 text-text-primary">
      <header className="fixed inset-x-0 top-0 z-10 border-b border-neutral-border bg-neutral-surface pb-4 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-[960px] items-center gap-5">
          <button ref={exitRef} type="button" onClick={onExit} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-neutral-surface-alt" aria-label="Keluar dari latihan">
            <X size={22} strokeWidth={2.5} aria-hidden="true" />
          </button>
          <ProgressBar value={value} max={max} className="flex-1" />
          <span className="shrink-0 text-right text-body-s font-bold text-text-secondary">{indicator}</span>
        </div>
      </header>
      {/* pt-32: Pengecualian skala jarak SDD 7.2.2: offset kompensasi tinggi elemen fixed/perataan, bukan jarak antarelemen. */}
      <main className="mx-auto flex max-w-[760px] flex-col gap-6 px-5 pt-32">{children}</main>
    </div>
  );
}

function QuizSession({ task, onAudioExpired }: { task: QuizTask; onAudioExpired: () => Promise<unknown> }): JSX.Element {
  const exit = useExit();
  const submit = useSubmitQuiz(task.id);
  const questions = sortQuestions(task.questions);
  const [step, setStep] = useState<QuizStep>({ kind: 'question', index: 0 });
  const [answers, setAnswers] = useState<Answers>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const exitRef = useRef<HTMLButtonElement>(null);
  const closeConfirm = useCallback(() => setConfirmOpen(false), []);
  const result = submit.data;
  const total = questions.length;

  // Konfirmasi hanya bila ada jawaban yang belum terkirim.
  const handleExit = (): void => {
    if (!result && Object.keys(answers).length > 0) setConfirmOpen(true);
    else exit();
  };

  const restart = (): void => {
    submit.reset();
    setAnswers({});
    setStep({ kind: 'question', index: 0 });
    window.scrollTo(0, 0);
  };

  const dialog = <ExitConfirmDialog open={confirmOpen} onCancel={closeConfirm} onConfirm={exit} returnFocusRef={exitRef} />;

  if (result) {
    // Layar hasil SDD 7.7.9 / SRS UI-QUIZ-02. Kunci jawaban baru terlihat di sini.
    return (
      <QuizFrame indicator="Hasil" value={total} max={total} onExit={handleExit} exitRef={exitRef}>
        <QuizResultView
          result={result}
          questions={questions}
          actions={
            <>
              {/* Tidak ada batas percobaan (SDD 3.9.5). */}
              <Button variant="accent" onClick={restart}>
                KERJAKAN LAGI
              </Button>
              <Button variant="outline" onClick={exit}>
                KEMBALI
              </Button>
              <Link to="/riwayat" className="flex min-h-11 items-center px-2 text-body text-brand-primary hover:underline sm:ml-auto">
                Lihat riwayat
              </Link>
            </>
          }
        />
        {dialog}
      </QuizFrame>
    );
  }

  if (step.kind === 'summary') {
    return (
      <QuizFrame indicator="Ringkasan" value={total} max={total} onExit={handleExit} exitRef={exitRef}>
        <p className="text-label text-brand-primary">{task.title}</p>
        <h1 className="text-h2">Ringkasan jawaban</h1>
        <ol className="flex flex-col gap-3">
          {questions.map((question, index) => (
            <li key={question.id} className="flex items-center justify-between gap-4 rounded-md border border-neutral-border bg-neutral-surface p-4">
              <div className="min-w-0">
                <p className="text-body-s text-text-secondary">Soal {index + 1}</p>
                <p className="text-body text-text-primary">
                  <ArabicOption option={question.options.find((option) => option.id === answers[question.id])} />
                </p>
              </div>
              <button type="button" onClick={() => setStep({ kind: 'question', index })} className="min-h-11 shrink-0 rounded-md px-3 text-body text-brand-primary hover:bg-neutral-surface-alt" aria-label={`Ubah jawaban soal ${index + 1}`}>
                Ubah
              </button>
            </li>
          ))}
        </ol>
        <p className="text-body-s text-text-secondary">Jawaban tidak dapat diubah setelah dikirim.</p>
        {submit.isError && (
          <p className="rounded-md bg-feedback-salah-soft px-5 py-3 text-body-s text-feedback-salah" role="alert">
            {submit.error instanceof ApiError ? submit.error.message : 'Terjadi kesalahan. Coba lagi.'}
          </p>
        )}
        <Button variant="accent" className="w-full" disabled={!allAnswered(questions, answers)} isLoading={submit.isPending} loadingText="MENGIRIM…" onClick={() => submit.mutate(buildSubmitInput(questions, answers))}>
          KIRIM JAWABAN
        </Button>
        {dialog}
      </QuizFrame>
    );
  }

  const question = questions[step.index];
  const selected = answers[question.id];
  const isLast = step.index === total - 1;
  // Kembali ke ringkasan bila semua soal sudah terjawab (dari tombol "Ubah").
  const goNext = (): void => setStep(allAnswered(questions, answers) && !isLast ? { kind: 'summary' } : nextStep(step, total));

  return (
    <QuizFrame indicator={`Soal ${step.index + 1} dari ${total}`} value={step.index + 1} max={total} onExit={handleExit} exitRef={exitRef}>
      <div>
        <p className="text-label text-brand-primary">{task.title}</p>
        <p className="mt-1 text-body-s text-text-secondary">{task.instruction}</p>
        <h1 className="mt-3 text-h2">{question.prompt}</h1>
      </div>
      {/* Audio soal tidak pernah diputar otomatis (SDD 7.11). */}
      <AudioPlayer key={question.id} src={question.audioUrl} label="audio soal" onExpired={onAudioExpired} />
      <div className="grid grid-cols-2 gap-4" role="group" aria-label="Pilihan jawaban">
        {question.options.map((option) => (
          <LetterCard key={option.id} letter={option.arabicLabel} label={option.label} selected={selected === option.id} onClick={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))} />
        ))}
      </div>
      <div className="flex gap-3">
        {step.index > 0 && (
          <Button variant="outline" className="flex-1" onClick={() => setStep(previousStep(step))}>
            SEBELUMNYA
          </Button>
        )}
        <Button variant="accent" className="flex-1" disabled={!selected} onClick={goNext}>
          {isLast || allAnswered(questions, answers) ? 'LIHAT RINGKASAN' : 'BERIKUTNYA'}
        </Button>
      </div>
      {dialog}
    </QuizFrame>
  );
}

// Dengar-Pilih (SDD 7.7.8, 3.9.4). [REKOMENDASI] Tampilan mengikuti halaman demo Fase 3 (Figma 07–09).
export function QuizTaskPage(): JSX.Element {
  const taskId = useParams().taskId ?? '';
  const exit = useExit();
  const { data, isPending, isError, error, refetch } = useQuizTask(taskId);

  if (isPending) {
    return (
      <QuizFrame indicator="" value={0} max={1} onExit={exit}>
        <div className="animate-pulse space-y-6 motion-reduce:animate-none" aria-busy="true" aria-label="Memuat">
          <div className="h-8 w-2/3 rounded-sm bg-neutral-border" />
          <div className="h-24 rounded-md bg-neutral-border" />
          <div className="grid grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="h-36 rounded-md bg-neutral-border" />
            ))}
          </div>
        </div>
      </QuizFrame>
    );
  }
  if (isError) {
    return (
      <QuizFrame indicator="" value={0} max={1} onExit={exit}>
        <ErrorState error={error} onRetry={() => void refetch()} />
      </QuizFrame>
    );
  }
  return <QuizSession key={data.id} task={data} onAudioExpired={() => refetch()} />;
}
