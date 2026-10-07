// Pesan untuk halaman login setelah sesi diakhiri server (mis. 403 AUTH_ACCOUNT_INACTIVE, SDD 3.16.5).
// Disimpan di memori, bukan di state navigasi, karena pengalihan ProtectedRoute dapat menimpa state itu.

let pending: string | null = null;

export const sessionNotice = {
  set(message: string): void {
    pending = message;
  },
  /** Membaca tanpa menghapus (aman dipanggil dua kali oleh StrictMode). */
  peek(): string | null {
    return pending;
  },
  clear(): void {
    pending = null;
  },
};
