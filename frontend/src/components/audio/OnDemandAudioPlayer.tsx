import { Play } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '../../lib/api/ApiError';
import { AudioPlayer } from './AudioPlayer';

interface OnDemandAudioPlayerProps {
  /** Meminta URL berbatas waktu; dipanggil saat tombol Putar ditekan dan sekali lagi bila URL kedaluwarsa. */
  fetchUrl: () => Promise<string>;
  /** Untuk label pembaca layar, mis. "rekaman percobaan ke-2 Siti Aisyah". */
  label: string;
  /** Teks tombol sebelum diputar. */
  buttonText: string;
}

/**
 * Pemutar yang meminta URL saat tombol Putar ditekan, bukan saat halaman dimuat (NFR-PRIV-02, SDD 7.7.20).
 * URL hanya disimpan di state komponen ini (tidak di cache). Kedaluwarsa → diminta ulang sekali (SDD 7.6.1).
 */
export function OnDemandAudioPlayer({ fetchUrl, label, buttonText }: OnDemandAudioPlayerProps): JSX.Element {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async () => {
    setLoading(true);
    setError(null);
    try {
      setUrl(await fetchUrl());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Audio gagal dimuat.');
    } finally {
      setLoading(false);
    }
  };

  if (url) {
    return (
      <div className="min-w-[16rem]">
        <AudioPlayer src={url} label={label} onExpired={async () => setUrl(await fetchUrl())} playOnLoad />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void request()}
        disabled={loading}
        aria-label={`Putar ${label}`}
        className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-md px-3 text-body text-brand-primary hover:bg-neutral-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary disabled:text-text-muted"
      >
        <Play size={18} aria-hidden="true" />
        {loading ? 'Memuat…' : buttonText}
      </button>
      {error && (
        <p className="px-3 text-body-s text-feedback-salah" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
