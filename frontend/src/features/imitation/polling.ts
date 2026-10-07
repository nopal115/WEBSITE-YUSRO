import type { PollingPlan } from './types';

/** Waktu-waktu pemeriksaan (ms sejak rekaman dikirim) dari jadwal backend, dibatasi stopAfterMs. */
export function checkTimes(plan: PollingPlan): number[] {
  const times: number[] = [];
  let at = 0;
  for (const step of plan.recommendedSchedule) {
    for (let index = 0; index < step.times; index += 1) {
      at += step.intervalMs;
      if (at > plan.stopAfterMs) return times;
      times.push(at);
    }
  }
  return times;
}

/** Jeda menuju pemeriksaan berikutnya dari posisi elapsedMs; null bila jadwal sudah habis. */
export function nextDelay(plan: PollingPlan, elapsedMs: number): number | null {
  const next = checkTimes(plan).find((at) => at > elapsedMs);
  return next === undefined ? null : next - elapsedMs;
}

export interface PollerClock {
  now: () => number;
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

export interface PollerVisibility {
  isHidden: () => boolean;
  /** Mengembalikan fungsi berhenti berlangganan. */
  subscribe: (listener: () => void) => () => void;
}

export interface PollerOptions {
  plan: PollingPlan;
  /** Lama evaluasi berjalan menurut server saat pemantauan dimulai (0 untuk respons 202). */
  initialElapsedMs: number;
  /** Mengembalikan true bila status sudah akhir (EVALUATED/FAILED). Galat dianggap belum selesai. */
  check: () => Promise<boolean>;
  /** Pemantauan otomatis berhenti tanpa status akhir: tampilkan "Periksa Status Sekarang". */
  onStop: () => void;
  clock: PollerClock;
  visibility: PollerVisibility;
}

/**
 * Pemantauan berkala SDD 7.7.11 / NFR-PERF-06: jadwal dari backend, dijeda saat tab tersembunyi,
 * diperiksa langsung saat tab kembali, berhenti setelah stopAfterMs (dihitung sejak rekaman dikirim,
 * termasuk waktu tab tersembunyi).
 */
export function createPoller({ plan, initialElapsedMs, check, onStop, clock, visibility }: PollerOptions): { dispose: () => void } {
  const startedAt = clock.now() - initialElapsedMs;
  let timer: unknown = null;
  let inFlight = false;
  let finished = false;

  const elapsed = () => clock.now() - startedAt;
  const clear = () => {
    if (timer !== null) clock.clearTimeout(timer);
    timer = null;
  };
  const stop = () => {
    if (finished) return;
    finished = true;
    clear();
    unsubscribe();
    onStop();
  };
  const done = () => {
    finished = true;
    clear();
    unsubscribe();
  };

  const schedule = () => {
    if (finished || visibility.isHidden()) return;
    const delay = nextDelay(plan, elapsed());
    if (delay === null) stop();
    else timer = clock.setTimeout(() => void run(), delay);
  };

  const run = async (thenStop = false) => {
    timer = null;
    if (finished) return;
    inFlight = true;
    let final = false;
    try {
      final = await check();
    } catch {
      final = false;
    }
    inFlight = false;
    if (finished) return;
    if (final) done();
    else if (thenStop) stop();
    else schedule();
  };

  const unsubscribe = visibility.subscribe(() => {
    if (finished) return;
    if (visibility.isHidden()) {
      clear();
      return;
    }
    if (inFlight) return;
    clear();
    void run(elapsed() >= plan.stopAfterMs);
  });

  if (elapsed() >= plan.stopAfterMs) void run(true);
  else schedule();

  return {
    dispose: () => {
      finished = true;
      clear();
      unsubscribe();
    },
  };
}
