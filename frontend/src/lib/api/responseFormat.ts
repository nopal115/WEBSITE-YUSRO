// Satu-satunya tempat yang mengetahui bentuk response backend.
//
// Frontend mengikuti format standar SDD 5.5:
//   sukses: { success: true, message, data, meta }
//   gagal : { success: false, message, errorCode, errors? }
// [TBD] Backend saat ini (branch backend-noval) masih mengirim JSON mentah untuk
// sukses dan format bawaan NestJS untuk error; keduanya tetap dibaca di sini.
// Bila backend berubah, cukup file ini yang disesuaikan.

/** Meta pagination SDD 5.5. */
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ParsedSuccess<T> {
  data: T;
  meta: PageMeta | null;
}

export interface ParsedErrorBody {
  /** Pesan siap tampil dari server (hanya format SDD 5.5, NFR-USE-05). */
  userMessage?: string;
  /** Pesan asli server untuk debug. */
  serverMessage?: string;
  code?: string;
  details?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPageMeta(value: unknown): value is PageMeta {
  return isRecord(value) && typeof value.page === 'number' && typeof value.totalPages === 'number';
}

export function parseSuccessWithMeta<T>(body: unknown): ParsedSuccess<T> {
  // Format SDD 5.5: { success: true, data, meta }
  if (isRecord(body) && body.success === true && 'data' in body) {
    return { data: body.data as T, meta: isPageMeta(body.meta) ? body.meta : null };
  }
  // Format backend saat ini: JSON mentah.
  return { data: body as T, meta: null };
}

export function parseSuccess<T>(body: unknown): T {
  return parseSuccessWithMeta<T>(body).data;
}

export function parseErrorBody(body: unknown): ParsedErrorBody {
  if (!isRecord(body)) return {};

  // Format SDD 5.5: { success: false, message, errorCode, errors? }
  if (body.success === false || typeof body.errorCode === 'string') {
    const message = typeof body.message === 'string' ? body.message : undefined;
    return {
      userMessage: message,
      serverMessage: message,
      code: typeof body.errorCode === 'string' ? body.errorCode : undefined,
      details: body.errors ?? body.details,
    };
  }

  // Format NestJS: { statusCode, message: string | string[], error }. Pesannya
  // berbahasa Inggris, jadi tidak dipakai sebagai pesan untuk pengguna.
  if (Array.isArray(body.message)) {
    const messages = body.message.filter((item): item is string => typeof item === 'string');
    return { serverMessage: messages.join('; '), details: messages };
  }
  if (typeof body.message === 'string') {
    return { serverMessage: body.message };
  }

  return {};
}
