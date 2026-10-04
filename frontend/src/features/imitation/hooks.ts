import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { imitationApi } from './api';
import { createPoller, type PollerVisibility } from './polling';
import type { PollingPlan, SubmissionStatus } from './types';

export const imitationKeys = {
  task: (taskId: string) => ['imitation', 'task', taskId] as const,
  submission: (submissionId: string) => ['imitation', 'submission', submissionId] as const,
};

export function useImitationTask(taskId: string) {
  return useQuery({
    queryKey: imitationKeys.task(taskId),
    queryFn: ({ signal }) => imitationApi.getTask(taskId, signal),
    // activeSubmission adalah keadaan langsung: tidak disimpan setelah halaman ditutup, sehingga membuka
    // ulang selalu memakai data segar (refetch yang terputus saat keluar dapat mengembalikan data lama).
    gcTime: 0,
  });
}

export function useSubmitRecording(taskId: string) {
  return useMutation({
    mutationFn: ({ blob, idempotencyKey }: { blob: Blob; idempotencyKey: string }) => imitationApi.submitRecording(taskId, blob, idempotencyKey),
  });
}

const isFinal = (status: SubmissionStatus) => status.evaluationStatus === 'EVALUATED' || status.evaluationStatus === 'FAILED';

const documentVisibility: PollerVisibility = {
  isHidden: () => document.hidden,
  subscribe: (listener) => {
    document.addEventListener('visibilitychange', listener);
    return () => document.removeEventListener('visibilitychange', listener);
  },
};

const browserClock = {
  now: () => Date.now(),
  setTimeout: (callback: () => void, ms: number) => window.setTimeout(callback, ms),
  clearTimeout: (handle: unknown) => window.clearTimeout(handle as number),
};

export interface MonitoredSubmission {
  submissionId: string;
  polling: PollingPlan;
  /** Lama evaluasi berjalan menurut server saat pemantauan dimulai. */
  elapsedMs: number;
}

/**
 * Pemantauan status evaluasi SDD 7.7.11. Dipakai oleh komponen yang di-key dengan submissionId,
 * sehingga keadaan awal selalu bersih untuk setiap submission.
 */
export function useEvaluationMonitor(taskId: string, submission: MonitoredSubmission) {
  const queryClient = useQueryClient();
  const [latest, setLatest] = useState<SubmissionStatus | null>(null);
  const [stopped, setStopped] = useState(false);
  const [checking, setChecking] = useState(false);
  // "Sudah berjalan": elapsedMs server terakhir + waktu lokal sejak diterima (tidak bergantung jam perangkat).
  const [baseline, setBaseline] = useState(() => ({ elapsedMs: submission.elapsedMs, at: Date.now() }));
  const [now, setNow] = useState(() => Date.now());

  const fetchStatus = useCallback(async (): Promise<SubmissionStatus> => {
    const status = await imitationApi.getSubmission(submission.submissionId);
    setLatest(status);
    if (status.evaluationStatus === 'SUBMITTED' || status.evaluationStatus === 'PROCESSING') {
      setBaseline({ elapsedMs: status.elapsedMs, at: Date.now() });
    } else {
      // Nilai, progress, riwayat, dan statistik berubah setelah status akhir (keputusan 15).
      void queryClient.invalidateQueries({ queryKey: ['learning'], refetchType: 'all' });
      void queryClient.invalidateQueries({ queryKey: ['progress'], refetchType: 'all' });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'all' });
      void queryClient.invalidateQueries({ queryKey: imitationKeys.task(taskId) });
    }
    return status;
  }, [queryClient, submission.submissionId, taskId]);

  useEffect(() => {
    const poller = createPoller({
      plan: submission.polling,
      initialElapsedMs: submission.elapsedMs,
      check: async () => isFinal(await fetchStatus()),
      onStop: () => setStopped(true),
      clock: browserClock,
      visibility: documentVisibility,
    });
    return poller.dispose;
  }, [fetchStatus, submission.elapsedMs, submission.polling]);

  const final = latest !== null && isFinal(latest);
  useEffect(() => {
    if (final) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [final]);

  /** "Periksa Status Sekarang": satu pemeriksaan, tanpa memulai ulang jadwal (G5). */
  const checkNow = useCallback(async () => {
    setChecking(true);
    try {
      await fetchStatus();
    } catch {
      // Status lama tetap ditampilkan; tombol tetap tersedia.
    } finally {
      setChecking(false);
    }
  }, [fetchStatus]);

  return { latest, stopped, checking, checkNow, elapsedMs: baseline.elapsedMs + Math.max(0, now - baseline.at) };
}
