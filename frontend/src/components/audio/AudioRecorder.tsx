import { Mic } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { formatElapsed } from '../../features/imitation/recorder';

interface AudioRecorderProps {
  /** Format hasil pickMimeType (urutan acceptedFormats dari server). */
  mimeType: string;
  maxDurationMs: number;
  /** Keterangan batas durasi dari constraints, mis. "Durasi 1–30 detik." */
  durationHint: string;
  disabled?: boolean;
  onStart: () => void;
  onRecorded: (blob: Blob, durationMs: number) => void;
  onPermissionDenied: () => void;
  /** Izin diberikan tetapi tombol sudah dilepas sebelum mikrofon siap. */
  onMicReady: () => void;
  onFailed: () => void;
}

interface Session {
  stream: MediaStream;
  recorder: MediaRecorder;
  context: AudioContext | null;
  frame: number;
  autoStop: ReturnType<typeof setTimeout>;
  startedAt: number;
  discard: boolean;
}

const HOLD_KEYS = new Set([' ', 'Enter']);

/** Level suara 0–1 dari sinyal waktu (RMS), untuk indikator saat merekam. */
function readLevel(analyser: AnalyserNode, buffer: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(buffer);
  let sum = 0;
  for (const value of buffer) {
    const centered = (value - 128) / 128;
    sum += centered * centered;
  }
  return Math.min(1, Math.sqrt(sum / buffer.length) * 4);
}

/**
 * Perekam tekan-dan-tahan SDD 7.6.2 / 7.7.10. Pointer capture menjaga rekaman tetap berjalan walau
 * jari bergeser keluar tombol; lepas, pointercancel, hilang fokus, atau tab tersembunyi menghentikan
 * rekaman. Spasi/Enter ditahan = merekam (SDD 7.11). Track mikrofon dihentikan begitu selesai.
 * [REKOMENDASI] Tampilan disusun dari SDD dan token; Figma 10–17 tidak dapat diakses.
 */
export function AudioRecorder({ mimeType, maxDurationMs, durationHint, disabled = false, onStart, onRecorded, onPermissionDenied, onMicReady, onFailed }: AudioRecorderProps): JSX.Element {
  const holdingRef = useRef(false);
  const acquiringRef = useRef(false);
  const sessionRef = useRef<Session | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);

  const release = useCallback((session: Session) => {
    clearTimeout(session.autoStop);
    cancelAnimationFrame(session.frame);
    session.stream.getTracks().forEach((track) => track.stop());
    void session.context?.close().catch(() => undefined);
    sessionRef.current = null;
    setRecording(false);
    setLevel(0);
  }, []);

  const end = useCallback(() => {
    holdingRef.current = false;
    const session = sessionRef.current;
    if (session && session.recorder.state === 'recording') session.recorder.stop();
  }, []);

  const begin = useCallback(async () => {
    holdingRef.current = true;
    if (acquiringRef.current || sessionRef.current) return;
    acquiringRef.current = true;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      acquiringRef.current = false;
      holdingRef.current = false;
      const name = (error as { name?: string }).name;
      if (name === 'NotAllowedError' || name === 'SecurityError') onPermissionDenied();
      else onFailed();
      return;
    }
    acquiringRef.current = false;
    if (!holdingRef.current) {
      // Tombol dilepas selama prompt izin: tidak ada yang direkam (G2).
      stream.getTracks().forEach((track) => track.stop());
      onMicReady();
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      holdingRef.current = false;
      onFailed();
      return;
    }

    const chunks: Blob[] = [];
    const session: Session = { stream, recorder, context: null, frame: 0, autoStop: setTimeout(end, maxDurationMs), startedAt: performance.now(), discard: false };
    sessionRef.current = session;

    // Indikator level suara (Web Audio API); bila gagal dibuat, perekaman tetap berjalan.
    let analyser: AnalyserNode | null = null;
    try {
      session.context = new AudioContext();
      analyser = session.context.createAnalyser();
      analyser.fftSize = 256;
      session.context.createMediaStreamSource(stream).connect(analyser);
    } catch {
      analyser = null;
    }
    const buffer = new Uint8Array(analyser?.fftSize ?? 0);
    const tick = () => {
      setElapsedMs(Math.min(performance.now() - session.startedAt, maxDurationMs));
      if (analyser) setLevel(readLevel(analyser, buffer));
      session.frame = requestAnimationFrame(tick);
    };

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const durationMs = Math.min(performance.now() - session.startedAt, maxDurationMs);
      release(session);
      if (!session.discard) onRecorded(new Blob(chunks, { type: recorder.mimeType || mimeType }), durationMs);
    };
    recorder.onerror = () => {
      session.discard = true;
      release(session);
      onFailed();
    };
    // Gangguan sistem (mikrofon dicabut, panggilan masuk) diperlakukan sebagai lepas.
    stream.getAudioTracks().forEach((track) => track.addEventListener('ended', end));

    recorder.start();
    session.startedAt = performance.now();
    setElapsedMs(0);
    setRecording(true);
    onStart();
    session.frame = requestAnimationFrame(tick);
  }, [end, maxDurationMs, mimeType, onFailed, onMicReady, onPermissionDenied, onRecorded, onStart, release]);

  // Tab tersembunyi saat merekam = lepas.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) end();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [end]);

  // Keluar halaman saat merekam: hentikan tanpa menghasilkan rekaman.
  useEffect(
    () => () => {
      const session = sessionRef.current;
      if (!session) return;
      session.discard = true;
      if (session.recorder.state === 'recording') session.recorder.stop();
      else release(session);
    },
    [release],
  );

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    void begin();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!HOLD_KEYS.has(event.key)) return;
    event.preventDefault();
    if (disabled || event.repeat) return;
    void begin();
  };
  const handleKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!HOLD_KEYS.has(event.key)) return;
    event.preventDefault();
    end();
  };

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <button
        type="button"
        disabled={disabled}
        aria-pressed={recording}
        aria-label={recording ? 'Sedang merekam. Lepaskan untuk berhenti' : 'Tekan dan tahan untuk merekam'}
        aria-describedby="perekam-petunjuk"
        onPointerDown={handlePointerDown}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={end}
        onContextMenu={(event) => event.preventDefault()}
        style={{ WebkitTouchCallout: 'none' }}
        className={`flex h-24 w-24 touch-none select-none items-center justify-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:bg-neutral-locked disabled:text-text-secondary ${
          recording ? 'bg-brand-accent text-text-primary ring-8 ring-brand-accent-soft' : 'bg-brand-primary text-text-on-brand hover:bg-brand-primary-hover'
        }`}
      >
        <Mic size={40} aria-hidden="true" />
      </button>

      {recording ? (
        <div className="flex w-full max-w-[320px] flex-col items-center gap-3">
          <p className="text-h3 tabular-nums text-text-primary">
            {formatElapsed(elapsedMs)} <span className="text-body-s text-text-secondary">/ {formatElapsed(maxDurationMs)}</span>
          </p>
          {/* Level suara: menandakan mikrofon benar-benar menangkap suara (SDD 7.7.10). */}
          <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-border" aria-hidden="true">
            <div className="h-full rounded-full bg-brand-primary" style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
          <p id="perekam-petunjuk" className="text-body text-text-secondary">
            Lepaskan tombol untuk berhenti.
          </p>
        </div>
      ) : (
        <div id="perekam-petunjuk" className="flex flex-col gap-1">
          <p className="text-body font-semibold text-text-primary">Tekan dan tahan untuk merekam</p>
          <p className="text-body-s text-text-secondary">Dengan papan ketik, tahan Spasi atau Enter.</p>
          <p className="text-body-s text-text-secondary">Rekam di tempat yang tenang. {durationHint}</p>
        </div>
      )}
    </div>
  );
}
