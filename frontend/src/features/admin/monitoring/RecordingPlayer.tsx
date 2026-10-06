import { OnDemandAudioPlayer } from '../../../components/audio/OnDemandAudioPlayer';
import { adminMonitoringApi } from './api';

/**
 * Pemutar rekaman Santri (SDD 7.7.20, NFR-PRIV-02, SDD 3.17.4): URL berbatas waktu diminta lewat
 * GET /admin/submissions/:id/recording-url saat tombol Putar ditekan, bukan saat tabel dimuat.
 */
export function RecordingPlayer({ submissionId, label }: { submissionId: string; label: string }): JSX.Element {
  return <OnDemandAudioPlayer fetchUrl={async () => (await adminMonitoringApi.getRecordingUrl(submissionId)).url} label={label} buttonText="Putar rekaman" />;
}
