import { Play } from 'lucide-react';
import { useState } from 'react';
import { AudioPlayer } from '../../../components/audio/AudioPlayer';
import { ApiError } from '../../../lib/api/ApiError';
import { adminMonitoringApi } from './api';

interface RecordingPlayerProps {
  submissionId: string;
  /** Untuk label pembaca layar, mis. "rekaman percobaan ke-2 Siti Aisyah". */
  label: string;
}

/**
 * Pemutar rekaman Santri (SDD 7.7.20, NFR-PRIV-02, SDD 3.17.4). URL berbatas waktu diminta saat tombol
 * Putar ditekan, bukan saat tabel dimuat, dan hanya disimpan di state komponen ini (tidak di cache).
 * Bila URL kedaluwarsa, AudioPlayer meminta URL baru sekali sebelum menampilkan galat (SDD 7.6.1).
 */
export function RecordingPlayer({ submissionId, label }: RecordingPlayerProps): JSX.Element {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async () => {
    setLoading(true);
    setError(null);
    try {
      setUrl((await adminMonitoringApi.getRecordingUrl(submissionId)).url);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Rekaman gagal dimuat.');
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setUrl((await adminMonitoringApi.getRecordingUrl(submissionId)).url);
  };

  if (url) {
    return (
      <div className="min-w-[16rem]">
        <AudioPlayer src={url} label={label} onExpired={refresh} playOnLoad />
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
        {loading ? 'Memuat…' : 'Putar rekaman'}
      </button>
      {error && (
        <p className="px-3 text-body-s text-feedback-salah" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
