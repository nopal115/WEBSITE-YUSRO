// Pemicu skenario galat untuk uji manual. Hanya terpasang di mode mock (window.__yusroMock).
import { tokenStore } from '../../auth/tokenStore';

export type FaultKind = number | 'network';

interface Fault {
  kind: FaultKind;
  pattern?: string;
}

const FAULTS_KEY = 'yusro.mock.faults';
const REVOKED_KEY = 'yusro.mock.revoked';

let delayMs: number | null = null;
let nextEvaluation: 'EVALUATED' | 'FAILED' | null = null;

function readList<T>(key: string): T[] {
  try {
    return JSON.parse(globalThis.sessionStorage?.getItem(key) ?? '[]') as T[];
  } catch {
    return [];
  }
}

function writeList(key: string, value: unknown[]): void {
  try {
    globalThis.sessionStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Abaikan: kontrol tetap berlaku sampai halaman dimuat ulang.
  }
}

function matches(pattern: string | undefined, target: string): boolean {
  if (!pattern) return true;
  const regex = new RegExp(pattern.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*'), 'i');
  return regex.test(target);
}

/** Mengambil (dan menghapus) galat pertama yang cocok dengan "METHOD path". */
export function takeFault(target: string): FaultKind | null {
  const faults = readList<Fault>(FAULTS_KEY);
  const index = faults.findIndex((fault) => matches(fault.pattern, target));
  if (index === -1) return null;
  const [fault] = faults.splice(index, 1);
  writeList(FAULTS_KEY, faults);
  return fault.kind;
}

/** Jeda tiruan: acak 300–800 ms kecuali diatur lewat setDelay. */
export function getDelay(): number {
  return delayMs ?? 300 + Math.floor(Math.random() * 500);
}

export function takeNextEvaluation(): 'EVALUATED' | 'FAILED' | null {
  const value = nextEvaluation;
  nextEvaluation = null;
  return value;
}

export function isRevoked(token: string): boolean {
  return readList<string>(REVOKED_KEY).includes(token);
}

export function revokeToken(token: string): void {
  writeList(REVOKED_KEY, [...readList<string>(REVOKED_KEY), token]);
}

export const mockControls = {
  /** Request berikutnya yang cocok ("METHOD path", mendukung *) dijawab dengan status ini atau 'network'. */
  failNext(kind: FaultKind, pattern?: string): void {
    writeList(FAULTS_KEY, [...readList<Fault>(FAULTS_KEY), { kind, pattern }]);
  },
  /** Mengatur jeda tiruan dalam ms; null mengembalikan jeda acak. */
  setDelay(ms: number | null): void {
    delayMs = ms;
  },
  /** Membatalkan token saat ini sehingga request berikutnya mendapat 401. */
  expireSession(): void {
    const token = tokenStore.get();
    if (token) revokeToken(token);
  },
  /** Menentukan hasil evaluasi Dengar-Tirukan berikutnya. */
  nextEvaluation(status: 'EVALUATED' | 'FAILED'): void {
    nextEvaluation = status;
  },
  /** Menghapus semua galat tertunda dan pengaturan. */
  reset(): void {
    writeList(FAULTS_KEY, []);
    delayMs = null;
    nextEvaluation = null;
  },
};

export function installMockControls(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as { __yusroMock: typeof mockControls }).__yusroMock = mockControls;
  console.info(
    '[mock] Mode mock aktif. Akun: santri@yusro.mock / santri123, admin@yusro.mock / admin1234. ' +
      'Kontrol: window.__yusroMock.failNext(500, "GET progress*"), failNext("network"), expireSession(), ' +
      'setDelay(ms), nextEvaluation("FAILED"), reset().',
  );
}
