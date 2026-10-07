import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkTimes, createPoller, nextDelay, type PollerClock, type PollerVisibility } from '../polling';
import type { PollingPlan } from '../types';

// Jadwal contoh SDD 5.10 / 7.7.11.
const plan: PollingPlan = {
  recommendedSchedule: [
    { intervalMs: 3000, times: 5 },
    { intervalMs: 10000, times: 6 },
    { intervalMs: 30000, times: 6 },
  ],
  stopAfterMs: 300000,
};

const clock: PollerClock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

function fakeVisibility() {
  let hidden = false;
  const listeners = new Set<() => void>();
  const visibility: PollerVisibility = {
    isHidden: () => hidden,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    visibility,
    listeners,
    set(value: boolean) {
      hidden = value;
      listeners.forEach((listener) => listener());
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(() => vi.useRealTimers());

describe('checkTimes / nextDelay', () => {
  it('menjabarkan jadwal backend', () => {
    const times = checkTimes(plan);
    expect(times).toHaveLength(17);
    expect(times.slice(0, 6)).toEqual([3000, 6000, 9000, 12000, 15000, 25000]);
    // 15 + 60 + 180 detik = 255 detik (SDD 7.7.11 menulis 270; salah hitung di dokumen).
    expect(times[times.length - 1]).toBe(255000);
  });

  it('dibatasi stopAfterMs', () => {
    expect(checkTimes({ ...plan, stopAfterMs: 20000 })).toEqual([3000, 6000, 9000, 12000, 15000]);
  });

  it('posisi dihitung dari elapsedMs', () => {
    expect(nextDelay(plan, 0)).toBe(3000);
    expect(nextDelay(plan, 4000)).toBe(2000);
    expect(nextDelay(plan, 20000)).toBe(5000);
    expect(nextDelay(plan, 255000)).toBeNull();
  });
});

describe('createPoller', () => {
  it('memeriksa sesuai jadwal dan berhenti saat status akhir', async () => {
    let calls = 0;
    const check = vi.fn(async () => ++calls === 3);
    const onStop = vi.fn();
    const { visibility } = fakeVisibility();
    createPoller({ plan, initialElapsedMs: 0, check, onStop, clock, visibility });
    await vi.advanceTimersByTimeAsync(2999);
    expect(check).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(6000);
    expect(check).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(600000);
    expect(check).toHaveBeenCalledTimes(3);
    expect(onStop).not.toHaveBeenCalled();
  });

  it('berhenti otomatis setelah jadwal habis dan memanggil onStop', async () => {
    const check = vi.fn(async () => false);
    const onStop = vi.fn();
    const { visibility, listeners } = fakeVisibility();
    createPoller({ plan, initialElapsedMs: 0, check, onStop, clock, visibility });
    await vi.advanceTimersByTimeAsync(255000);
    expect(check).toHaveBeenCalledTimes(17);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
    await vi.advanceTimersByTimeAsync(600000);
    expect(check).toHaveBeenCalledTimes(17);
  });

  it('melanjutkan dari elapsedMs server', async () => {
    const check = vi.fn(async () => false);
    const { visibility } = fakeVisibility();
    createPoller({ plan, initialElapsedMs: 20000, check, onStop: vi.fn(), clock, visibility });
    await vi.advanceTimersByTimeAsync(4999);
    expect(check).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('dijeda saat tab tersembunyi dan langsung memeriksa saat tab kembali', async () => {
    const check = vi.fn(async () => false);
    const tab = fakeVisibility();
    createPoller({ plan, initialElapsedMs: 0, check, onStop: vi.fn(), clock, visibility: tab.visibility });
    await vi.advanceTimersByTimeAsync(3000);
    expect(check).toHaveBeenCalledTimes(1);
    tab.set(true);
    await vi.advanceTimersByTimeAsync(60000);
    expect(check).toHaveBeenCalledTimes(1);
    tab.set(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(check).toHaveBeenCalledTimes(2);
    // Jadwal lanjut dari posisi 63 detik: pemeriksaan berikutnya pada 65 detik.
    await vi.advanceTimersByTimeAsync(2000);
    expect(check).toHaveBeenCalledTimes(3);
  });

  it('tab kembali setelah stopAfterMs: periksa sekali lalu berhenti', async () => {
    const check = vi.fn(async () => false);
    const onStop = vi.fn();
    const tab = fakeVisibility();
    createPoller({ plan, initialElapsedMs: 0, check, onStop, clock, visibility: tab.visibility });
    tab.set(true);
    await vi.advanceTimersByTimeAsync(400000);
    expect(check).toHaveBeenCalledTimes(0);
    tab.set(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(check).toHaveBeenCalledTimes(1);
    expect(onStop).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(600000);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('dibuka ulang setelah stopAfterMs: periksa sekali lalu berhenti', async () => {
    const check = vi.fn(async () => false);
    const onStop = vi.fn();
    createPoller({ plan, initialElapsedMs: 310000, check, onStop, clock, visibility: fakeVisibility().visibility });
    await vi.advanceTimersByTimeAsync(0);
    expect(check).toHaveBeenCalledTimes(1);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('galat pemeriksaan tidak menghentikan jadwal', async () => {
    const check = vi.fn(async () => {
      throw new Error('jaringan');
    });
    createPoller({ plan, initialElapsedMs: 0, check, onStop: vi.fn(), clock, visibility: fakeVisibility().visibility });
    await vi.advanceTimersByTimeAsync(6000);
    expect(check).toHaveBeenCalledTimes(2);
  });

  it('dispose menghentikan tanpa onStop', async () => {
    const check = vi.fn(async () => false);
    const onStop = vi.fn();
    const tab = fakeVisibility();
    const poller = createPoller({ plan, initialElapsedMs: 0, check, onStop, clock, visibility: tab.visibility });
    poller.dispose();
    await vi.advanceTimersByTimeAsync(600000);
    expect(check).not.toHaveBeenCalled();
    expect(onStop).not.toHaveBeenCalled();
    expect(tab.listeners.size).toBe(0);
  });
});
