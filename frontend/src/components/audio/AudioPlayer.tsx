import { Pause, Play } from 'lucide-react';
import { useRef, useState } from 'react';

interface AudioPlayerProps {
  src: string;
  /** Nama audio untuk label tombol, mis. "audio materi". */
  label: string;
  /**
   * Dipanggil sekali saat audio gagal dimuat, untuk meminta URL baru (presigned URL berlaku
   * 15 menit, SDD 5.8 / 7.6.1). Setelah itu pemuatan dicoba sekali lagi sebelum galat tampil.
   */
  onExpired?: () => Promise<unknown>;
  /**
   * Langsung memutar begitu audio siap. Hanya untuk pemutar yang dibuka atas tindakan pengguna
   * (mis. tombol Putar rekaman di Monitoring), sehingga tetap tidak ada autoplay (SDD 7.11).
   */
  playOnLoad?: boolean;
}

type PlayerStatus = 'loading' | 'ready' | 'playing' | 'error';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/**
 * Pemutar audio SDD 7.6.1 / 7.11: tombol putar, durasi, dan bilah posisi yang dapat dipakai
 * dengan papan ketik (Tab, Spasi/Enter, panah). Audio tidak pernah diputar otomatis.
 * [REKOMENDASI] Tampilan menunggu Figma.
 */
export function AudioPlayer({ src, label, onExpired, playOnLoad = false }: AudioPlayerProps): JSX.Element {
  const audioRef = useRef<HTMLAudioElement>(null);
  const retriedRef = useRef(false);
  const startedRef = useRef(false);
  const [status, setStatus] = useState<PlayerStatus>('loading');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const handleError = async (): Promise<void> => {
    if (retriedRef.current || !onExpired) {
      setStatus('error');
      return;
    }
    retriedRef.current = true;
    setStatus('loading');
    try {
      await onExpired();
      // URL baru masuk lewat prop src; bila URL sama, muat ulang secara eksplisit.
      audioRef.current?.load();
    } catch {
      setStatus('error');
    }
  };

  const togglePlay = (): void => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => setStatus('error'));
    else audio.pause();
  };

  const retry = (): void => {
    retriedRef.current = false;
    setStatus('loading');
    audioRef.current?.load();
  };

  const playing = status === 'playing';
  const disabled = status === 'loading' || status === 'error';

  return (
    <div className="flex items-center gap-4 rounded-md border border-neutral-border bg-neutral-surface p-4">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration);
          setStatus('ready');
          if (playOnLoad && !startedRef.current) {
            startedRef.current = true;
            void event.currentTarget.play().catch(() => undefined);
          }
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setStatus('playing')}
        onPause={() => setStatus('ready')}
        onEnded={() => setStatus('ready')}
        onError={() => void handleError()}
      />
      <button
        type="button"
        onClick={togglePlay}
        disabled={disabled}
        aria-label={playing ? `Jeda ${label}` : `Putar ${label}`}
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-primary text-text-on-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:bg-neutral-locked disabled:text-text-secondary"
      >
        {playing ? <Pause size={24} fill="currentColor" aria-hidden="true" /> : <Play size={24} fill="currentColor" aria-hidden="true" />}
      </button>

      {status === 'error' ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3" role="alert">
          <p className="text-body-s text-text-primary">Audio gagal dimuat.</p>
          <button type="button" onClick={retry} className="min-h-11 rounded-md px-3 text-body text-brand-primary underline">
            Coba lagi
          </button>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            disabled={disabled}
            onChange={(event) => {
              const audio = audioRef.current;
              if (audio) audio.currentTime = Number(event.target.value);
            }}
            aria-label={`Posisi ${label}`}
            aria-valuetext={`${formatTime(currentTime)} dari ${formatTime(duration)}`}
            className="h-11 min-w-0 flex-1 accent-brand-primary"
          />
          <span className="shrink-0 whitespace-nowrap text-caption text-text-secondary" aria-live="off">
            {status === 'loading' ? 'Memuat…' : `${formatTime(currentTime)} / ${formatTime(duration)}`}
          </span>
        </div>
      )}
    </div>
  );
}
