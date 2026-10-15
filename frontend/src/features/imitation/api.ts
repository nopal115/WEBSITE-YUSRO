import { apiRequest, apiRequestWithMeta } from '../../lib/api/client';
import { withPage, type PageParams, type Paginated } from '../../lib/api/types';
import { recordingFileName } from './recorder';
import type { ImitationTask, SubmissionHistoryItem, SubmissionStatus, SubmitRecordingResult } from './types';

// SDD 5.10.
export const imitationApi = {
  getTask: (taskId: string, signal?: AbortSignal): Promise<ImitationTask> =>
    apiRequest<ImitationTask>(`imitation/tasks/${encodeURIComponent(taskId)}`, { signal }),

  /**
   * Mengunggah rekaman sebagai field multipart `audio_file` (SDD 5.10).
   * Idempotency-Key yang sama untuk pengiriman ulang mengembalikan submission yang sama (SDD 5.23).
   * Nama berkas berekstensi sesuai format (rekaman.webm / rekaman.mp4, SDD 5.10).
   */
  submitRecording: (taskId: string, recording: Blob, idempotencyKey: string): Promise<SubmitRecordingResult> => {
    const form = new FormData();
    form.append('audio_file', recording, recordingFileName(recording.type));
    return apiRequest<SubmitRecordingResult>(`imitation/tasks/${encodeURIComponent(taskId)}/submissions`, {
      method: 'POST',
      body: form,
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  },

  getSubmission: (submissionId: string, signal?: AbortSignal): Promise<SubmissionStatus> =>
    apiRequest<SubmissionStatus>(`imitation/submissions/${encodeURIComponent(submissionId)}`, { signal }),

  getTaskSubmissions: (taskId: string, params?: PageParams, signal?: AbortSignal): Promise<Paginated<SubmissionHistoryItem>> =>
    apiRequestWithMeta<SubmissionHistoryItem[]>(withPage(`imitation/tasks/${encodeURIComponent(taskId)}/submissions`, params), {
      signal,
    }),
};
