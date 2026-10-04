import { AlertTriangle, CheckCircle2, Hourglass, X } from 'lucide-react';
import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode, type Ref } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router-dom';
import { AudioPlayer } from '../../components/audio/AudioPlayer';
import { AudioRecorder } from '../../components/audio/AudioRecorder';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ApiError } from '../../lib/api/ApiError';
import { formatScore } from '../dashboard/view';
import { ErrorState } from '../learning/QueryStates';
import { ExitConfirmDialog } from '../quiz/ExitConfirmDialog';
import { useEvaluationMonitor, useImitationTask, useSubmitRecording, type MonitoredSubmission } from './hooks';
import {
  durationHint,
  formatElapsed,
  initialRecorderState,
  MIC_READY_MESSAGE,
  needsLeaveGuard,
  pickMimeType,
  recorderReducer,
  type RecorderState,
  type UploadError,
} from './recorder';
import type { ImitationConstraints, ImitationTask } from './types';

// Kalimat SDD 7.9.
const UNSUPPORTED_MESSAGE = 'Perangkat atau browser Anda tidak mendukung perekaman suara. Coba gunakan Chrome, Edge, atau Firefox versi terbaru.';
const PERMISSION_MESSAGE = 'Izin mikrofon belum diberikan. Aktifkan izin mikrofon pada pengaturan browser, lalu muat ulang halaman.';
const LEAVE_MESSAGE = 'Rekaman belum dikirim dan akan hilang jika halaman ditutup. Tetap tinggalkan halaman?';

/** Keluar: kembali ke halaman sebelumnya, atau ke /belajar bila tidak ada riwayat. */
function useExit(): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (historyIndex > 0) navigate(-1);
    else navigate('/belajar');
  }, [navigate]);
}

/** Format rekaman yang didukung perangkat; null = UNSUPPORTED (NFR-COMP-03). */
function supportedMimeType(constraints: ImitationConstraints): string | null {
  if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.getUserMedia !== 'function') return null;
  if (typeof MediaRecorder === 'undefined') return null;
  return pickMimeType(constraints.acceptedFormats, (type) => MediaRecorder.isTypeSupported(type));
}

const AUDIO_REJECTED = new Set(['AUDIO_TOO_LARGE', 'AUDIO_DURATION_INVALID', 'AUDIO_FORMAT_UNSUPPORTED', 'AUDIO_UNREADABLE', 'AUDIO_SILENT', 'VALIDATION_ERROR', 'TASK_INACTIVE']);

/** Galat pengiriman SDD 5.10 / 3.6.8 / 3.10.8 (409 IMITATION_ACTIVE_EXISTS ditangani terpisah). */
function uploadErrorFrom(error: unknown, constraints: ImitationConstraints): UploadError {
  if (!(error instanceof ApiError)) return { message: 'Rekaman gagal dikirim. Coba kirim lagi.' };
  if (error.code === 'IMITATION_COOLDOWN' || error.status === 429) {
    return { message: error.message, cooldownUntil: Date.now() + constraints.cooldownSeconds * 1000 };
  }
  if (error.status === 413 || error.status === 422 || (error.code !== undefined && AUDIO_REJECTED.has(error.code))) {
    return { message: error.message, canResend: false };
  }
  return { message: error.message };
}

/** Kerangka layar latihan penuh: header tetap (X dan judul) dan isi terpusat. */
function TaskFrame({ onExit, exitRef, children }: { onExit: () => void; exitRef?: Ref<HTMLButtonElement>; children: ReactNode }): JSX.Element {
  return (
    <div className="min-h-screen bg-neutral-surface-alt pb-16 text-text-primary">
      <header className="fixed inset-x-0 top-0 z-10 border-b border-neutral-border bg-neutral-surface pb-4 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-[960px] items-center gap-5">
          <button ref={exitRef} type="button" onClick={onExit} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-neutral-surface-alt" aria-label="Keluar dari latihan">
            <X size={22} strokeWidth={2.5} aria-hidden="true" />
          </button>
          <p className="text-h3 text-text-primary">Dengar-Tirukan</p>
        </div>
      </header>
      {/* pt-28: Pengecualian skala jarak SDD 7.2.2: offset kompensasi tinggi elemen fixed/perataan, bukan jarak antarelemen. */}
      <main className="mx-auto flex max-w-[760px] flex-col gap-6 px-5 pt-28">{children}</main>
    </div>
  );
}

function Notice({ tone, children }: { tone: 'info' | 'error'; children: string }): JSX.Element {
  const classes = tone === 'error' ? 'bg-feedback-salah-soft text-feedback-salah' : 'bg-semantic-info-soft text-text-primary';
  return (
    <p className={`rounded-md px-5 py-3 text-body-s ${classes}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}

/** Tampilan 5, 6a, 6b SDD 7.7.10 dengan pemantauan SDD 7.7.11. Di-key dengan submissionId. */
function EvaluationPanel({ taskId, submission, onRetry, onContinue }: { taskId: string; submission: MonitoredSubmission; onRetry: () => void; onContinue: () => void }): JSX.Element {
  const { latest, stopped, checking, checkNow, elapsedMs } = useEvaluationMonitor(taskId, submission);

  let content: JSX.Element;
  if (latest?.evaluationStatus === 'EVALUATED') {
    content = (
      <Card className="flex flex-col gap-4">
        <h1 className="flex items-center gap-2 text-h3 text-feedback-benar">
          <CheckCircle2 size={24} aria-hidden="true" />
          Evaluasi selesai
        </h1>
        <div>
          <p className="text-label text-text-muted">NILAI</p>
          <p className="text-score text-brand-primary">
            {formatScore(latest.score)}
            <span className="text-h2 text-text-secondary"> / 100</span>
          </p>
          {/* Label kategori dari server, ditampilkan netral (bukan FeedbackBar). */}
          <p className="text-h3 text-text-primary">{latest.feedbackLabel}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="accent" onClick={onRetry}>
            COBA LAGI
          </Button>
          <Button variant="outline" onClick={onContinue}>
            LANJUT
          </Button>
        </div>
      </Card>
    );
  } else if (latest?.evaluationStatus === 'FAILED') {
    // 6b: state/failed, bukan merah; tanpa informasi teknis (UI-IMITATE-03). userMessage tidak ditampilkan (G7).
    content = (
      <Card className="flex flex-col gap-4">
        <h1 className="flex items-center gap-2 text-h3 text-state-failed">
          <AlertTriangle size={24} aria-hidden="true" />
          Evaluasi gagal diproses
        </h1>
        <p className="text-body text-text-primary">Rekaman Anda tersimpan dan percobaan ini tetap tercatat. Nilai belum tersedia.</p>
        <Button variant="accent" className="self-start" onClick={onRetry}>
          KIRIM ULANG REKAMAN
        </Button>
      </Card>
    );
  } else {
    content = (
      <Card className="flex flex-col gap-4">
        <h1 className="flex items-center gap-2 text-h3 text-state-processing">
          <Hourglass size={24} aria-hidden="true" />
          {stopped ? 'Evaluasi masih diproses.' : 'Evaluasi sedang diproses…'}
        </h1>
        {stopped ? (
          <>
            <p className="text-body text-text-secondary">Pemeriksaan otomatis dihentikan.</p>
            <Button variant="primary" className="self-start" isLoading={checking} loadingText="MEMERIKSA…" onClick={() => void checkNow()}>
              PERIKSA STATUS SEKARANG
            </Button>
          </>
        ) : (
          <p className="text-body text-text-secondary">
            Hasil akan muncul sendiri di halaman ini.
            <br />
            Anda tidak perlu menekan apa pun.
          </p>
        )}
        <p className="text-body-s tabular-nums text-text-secondary">Sudah berjalan {formatElapsed(elapsedMs)}</p>
      </Card>
    );
  }

  // Perubahan status diumumkan ke pembaca layar (SDD 7.11).
  return <div aria-live="polite">{content}</div>;
}

/** Waktu sekarang yang diperbarui berkala selama active (hitung mundur 429). */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

function RecorderPanel({
  task,
  state,
  mimeType,
  recordingUrl,
  dispatch,
  onRecorded,
  onSubmit,
}: {
  task: ImitationTask;
  state: RecorderState;
  mimeType: string | null;
  recordingUrl: string | null;
  dispatch: (event: Parameters<typeof recorderReducer>[1]) => void;
  onRecorded: (blob: Blob, durationMs: number) => void;
  onSubmit: () => void;
}): JSX.Element {
  const error = state.status === 'READY' ? state.error : undefined;
  const cooldownUntil = error?.cooldownUntil;
  const now = useNow(cooldownUntil !== undefined);
  const remaining = cooldownUntil === undefined ? 0 : Math.ceil((cooldownUntil - now) / 1000);
  const coolingDown = remaining > 0;

  if (state.status === 'UNSUPPORTED' || mimeType === null) return <Notice tone="info">{UNSUPPORTED_MESSAGE}</Notice>;
  if (state.status === 'PERMISSION_DENIED') return <Notice tone="error">{PERMISSION_MESSAGE}</Notice>;

  if (state.status === 'READY' || state.status === 'UPLOADING') {
    const uploading = state.status === 'UPLOADING';
    return (
      <div className="flex flex-col gap-4">
        <p className="text-h3 text-text-primary" role="status">
          {uploading ? 'Mengunggah rekaman…' : 'Rekaman siap dikirim'}
        </p>
        {recordingUrl && <AudioPlayer src={recordingUrl} label="rekaman Anda" />}
        {uploading && (
          <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-border" role="progressbar" aria-label="Mengunggah rekaman">
            <div className="h-full w-2/5 animate-indeterminate rounded-full bg-brand-primary motion-reduce:w-full motion-reduce:animate-none" />
          </div>
        )}
        {error && <Notice tone="error">{error.message}</Notice>}
        {coolingDown && <p className="text-body-s text-text-secondary">Anda dapat mengirim lagi dalam {remaining} detik.</p>}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" disabled={uploading} onClick={() => dispatch({ type: 'DISCARD' })}>
            REKAM ULANG
          </Button>
          <Button variant="accent" disabled={error?.canResend === false || coolingDown} isLoading={uploading} loadingText="MENGIRIM…" onClick={onSubmit}>
            {error && error.canResend !== false && error.cooldownUntil === undefined ? 'COBA KIRIM LAGI' : 'KIRIM REKAMAN'}
          </Button>
        </div>
      </div>
    );
  }

  const message = state.status === 'TOO_SHORT' ? state.message : state.status === 'IDLE' ? state.message : undefined;
  return (
    <div className="flex flex-col gap-4">
      {message && <Notice tone={message === MIC_READY_MESSAGE ? 'info' : 'error'}>{message}</Notice>}
      <AudioRecorder
        mimeType={mimeType}
        maxDurationMs={task.constraints.maxDurationMs}
        durationHint={durationHint(task.constraints)}
        onStart={() => dispatch({ type: 'START' })}
        onRecorded={onRecorded}
        onPermissionDenied={() => dispatch({ type: 'PERMISSION_DENIED' })}
        onMicReady={() => dispatch({ type: 'MIC_READY' })}
        onFailed={() => dispatch({ type: 'RECORD_FAILED' })}
      />
    </div>
  );
}

function ImitationSession({ task, onReload }: { task: ImitationTask; onReload: () => Promise<ImitationTask | undefined> }): JSX.Element {
  const exit = useExit();
  const submit = useSubmitRecording(task.id);
  const [mimeType] = useState(() => supportedMimeType(task.constraints));
  const [state, dispatch] = useReducer(recorderReducer, initialRecorderState, (initial) => (mimeType === null ? { status: 'UNSUPPORTED' as const } : initial));
  // Evaluasi berjalan saat halaman dibuka: langsung DIPROSES (keputusan 12).
  const [evaluation, setEvaluation] = useState<MonitoredSubmission | null>(() =>
    task.activeSubmission ? { submissionId: task.activeSubmission.submissionId, polling: task.activeSubmission.polling, elapsedMs: task.activeSubmission.elapsedMs } : null,
  );
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const exitRef = useRef<HTMLButtonElement>(null);

  // Rekaman hanya di memori (BR-IMITATE-06); URL objek dilepas saat rekaman berganti/halaman ditutup.
  useEffect(() => {
    if (!recordingUrl) return;
    return () => URL.revokeObjectURL(recordingUrl);
  }, [recordingUrl]);

  // FR-IMITATE-08: tutup tab / muat ulang (beforeunload) dan navigasi di dalam aplikasi (useBlocker),
  // hanya saat RECORDING, READY, UPLOADING. Mati begitu rekaman terkirim.
  const guard = evaluation === null && needsLeaveGuard(state);
  const blocker = useBlocker(guard);
  useEffect(() => {
    if (!guard) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [guard]);
  const cancelLeave = useCallback(() => blocker.reset?.(), [blocker]);

  const handleRecorded = useCallback(
    (blob: Blob, durationMs: number) => {
      setRecordingUrl(URL.createObjectURL(blob));
      dispatch({ type: 'RECORDED', recording: { blob, mimeType: blob.type, durationMs, idempotencyKey: crypto.randomUUID() }, constraints: task.constraints });
    },
    [task.constraints],
  );

  const handleSubmit = (): void => {
    if (state.status !== 'READY') return;
    const { recording } = state;
    dispatch({ type: 'UPLOAD' });
    submit.mutate(
      { blob: recording.blob, idempotencyKey: recording.idempotencyKey },
      {
        onSuccess: (result) => {
          dispatch({ type: 'UPLOADED', result });
          setRecordingUrl(null);
          setEvaluation({ submissionId: result.submissionId, polling: result.polling, elapsedMs: 0 });
        },
        onError: async (error) => {
          if (error instanceof ApiError && error.code === 'IMITATION_ACTIVE_EXISTS') {
            // Evaluasi lain masih berjalan: muat ulang tugas dan tampilkan DIPROSES.
            dispatch({ type: 'RESET' });
            setRecordingUrl(null);
            const fresh = await onReload();
            const active = fresh?.activeSubmission;
            if (active) setEvaluation({ submissionId: active.submissionId, polling: active.polling, elapsedMs: active.elapsedMs });
            return;
          }
          dispatch({ type: 'UPLOAD_FAILED', error: uploadErrorFrom(error, task.constraints) });
        },
      },
    );
  };

  const retry = (): void => {
    setEvaluation(null);
    dispatch({ type: 'RESET' });
    window.scrollTo(0, 0);
  };

  return (
    <TaskFrame onExit={exit} exitRef={exitRef}>
      {evaluation ? (
        <EvaluationPanel key={evaluation.submissionId} taskId={task.id} submission={evaluation} onRetry={retry} onContinue={exit} />
      ) : (
        <>
          <div>
            <p className="text-label text-brand-primary">{task.title}</p>
            <p className="mt-1 text-body-s text-text-secondary">{task.instruction}</p>
          </div>
          <Card className="flex flex-col gap-5">
            <h1 className="text-h3">Dengarkan contoh bacaan</h1>
            {/* Audio referensi tidak pernah diputar otomatis (SDD 7.11). */}
            <AudioPlayer src={task.referenceAudio.url} label="audio referensi" onExpired={onReload} />
            {/* Peran Arab XL (SDD 7.4.1). */}
            <p className="break-words text-center font-arabic text-arabic-xl text-text-primary" lang="ar" dir="rtl">
              {task.arabicText}
            </p>
          </Card>
          <Card className="flex flex-col gap-5">
            <h2 className="text-h3">Kemudian tirukan</h2>
            <RecorderPanel task={task} state={state} mimeType={mimeType} recordingUrl={recordingUrl} dispatch={dispatch} onRecorded={handleRecorded} onSubmit={handleSubmit} />
          </Card>
        </>
      )}
      <ExitConfirmDialog
        open={blocker.state === 'blocked'}
        onCancel={cancelLeave}
        onConfirm={() => blocker.proceed?.()}
        returnFocusRef={exitRef}
        title="Tinggalkan halaman?"
        message={LEAVE_MESSAGE}
      />
    </TaskFrame>
  );
}

// Dengar-Tirukan (SDD 7.7.10, 7.7.11). [REKOMENDASI] Tampilan disusun dari SDD, UI kit, dan token; Figma 10–17 tidak dapat diakses.
export function ImitationTaskPage(): JSX.Element {
  const taskId = useParams().taskId ?? '';
  const exit = useExit();
  const { data, isPending, isError, error, refetch } = useImitationTask(taskId);
  const reload = useCallback(async () => (await refetch()).data, [refetch]);

  if (isPending) {
    return (
      <TaskFrame onExit={exit}>
        <div className="animate-pulse space-y-6 motion-reduce:animate-none" aria-busy="true" aria-label="Memuat">
          <div className="h-6 w-2/3 rounded-sm bg-neutral-border" />
          <div className="h-64 rounded-md bg-neutral-border" />
          <div className="h-48 rounded-md bg-neutral-border" />
        </div>
      </TaskFrame>
    );
  }
  if (isError) {
    return (
      <TaskFrame onExit={exit}>
        <ErrorState error={error} onRetry={() => void refetch()} />
      </TaskFrame>
    );
  }
  return <ImitationSession key={data.id} task={data} onReload={reload} />;
}
