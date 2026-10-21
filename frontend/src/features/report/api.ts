import { apiRequestBlob, type BlobResult } from '../../lib/api/client';

// SDD 5.13. Laporan selalu milik pemegang token; tidak ada parameter identitas.
export const reportApi = {
  downloadPdf: (signal?: AbortSignal): Promise<BlobResult> => apiRequestBlob('report/pdf', { signal }),
  downloadCertificate: (stageId?: string, signal?: AbortSignal): Promise<BlobResult> =>
    apiRequestBlob(stageId ? `report/certificate/${stageId}` : 'report/certificate', { signal }),
};
