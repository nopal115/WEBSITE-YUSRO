// TODO(SDD 6.3): Penyimpanan ini SEMENTARA dan menyimpang dari SDD 6.3.
// SDD menetapkan access token disimpan di memori dan refresh token di cookie
// HttpOnly. Backend saat ini (branch backend-noval) belum menyediakan refresh
// token, sehingga token disimpan di sessionStorage agar sesi tidak hilang saat
// halaman di-reload. Risikonya: token bisa dibaca skrip apa pun yang berjalan di
// halaman (XSS). Ganti dengan token di memori + refresh token begitu backend
// menyediakannya; cukup ubah file ini.

const TOKEN_KEY = 'yusro.accessToken';

type Listener = () => void;

const listeners = new Set<Listener>();

// Cadangan bila sessionStorage tidak tersedia (mode privat ketat, dsb.).
let memoryToken: string | null = null;

function getStorage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

export const tokenStore = {
  get(): string | null {
    try {
      return getStorage()?.getItem(TOKEN_KEY) ?? memoryToken;
    } catch {
      return memoryToken;
    }
  },

  set(token: string): void {
    memoryToken = token;
    try {
      getStorage()?.setItem(TOKEN_KEY, token);
    } catch {
      // Tetap tersimpan di memori.
    }
    notify();
  },

  clear(): void {
    memoryToken = null;
    try {
      getStorage()?.removeItem(TOKEN_KEY);
    } catch {
      // Abaikan; token di memori sudah dihapus.
    }
    notify();
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
