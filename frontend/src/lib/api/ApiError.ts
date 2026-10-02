import { parseErrorBody } from './responseFormat';

/** Status untuk kegagalan jaringan (request tidak sampai ke server). */
export const NETWORK_ERROR_STATUS = 0;

interface ApiErrorInit {
  status: number;
  message?: string;
  serverMessage?: string;
  code?: string;
  details?: unknown;
}

/**
 * Bentuk error tunggal untuk seluruh aplikasi.
 * `message` selalu pesan Bahasa Indonesia yang aman ditampilkan ke pengguna;
 * pesan asli dari server disimpan di `serverMessage` untuk keperluan debug.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly serverMessage?: string;
  readonly details?: unknown;

  constructor({ status, message, serverMessage, code, details }: ApiErrorInit) {
    super(message ?? userMessageForStatus(status));
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.serverMessage = serverMessage;
    this.details = details;
  }

  get isNetworkError(): boolean {
    return this.status === NETWORK_ERROR_STATUS;
  }
}

export function userMessageForStatus(status: number): string {
  switch (status) {
    case NETWORK_ERROR_STATUS:
      return 'Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi.';
    case 400:
      return 'Data yang dikirim tidak valid. Periksa kembali isian Anda.';
    case 401:
      return 'Sesi Anda telah berakhir. Silakan masuk kembali.';
    case 403:
      return 'Anda tidak memiliki akses untuk melakukan aksi ini.';
    case 404:
      return 'Data yang dicari tidak ditemukan.';
    case 409:
      return 'Data bertentangan dengan data yang sudah ada.';
    case 422:
      return 'Data tidak dapat diproses. Periksa kembali isian Anda.';
    case 429:
      return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
    default:
      return status >= 500
        ? 'Terjadi gangguan pada server. Coba lagi beberapa saat lagi.'
        : 'Terjadi kesalahan. Coba lagi.';
  }
}

export function createApiError(status: number, body: unknown): ApiError {
  return new ApiError({ status, ...parseErrorBody(body) });
}

export function createNetworkError(cause?: unknown): ApiError {
  return new ApiError({ status: NETWORK_ERROR_STATUS, details: cause });
}
