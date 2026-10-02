// Satu-satunya tempat yang mengetahui bentuk response backend.
//
// [TBD] Backend saat ini (branch backend-noval) mengirim JSON mentah untuk
// sukses dan format bawaan NestJS untuk error. SDD 5.5 menetapkan amplop
// { success, data } / { success: false, errorCode, message }. Keduanya
// didukung di sini; bila backend berubah, cukup file ini yang disesuaikan.

export interface ParsedErrorBody {
  serverMessage?: string;
  code?: string;
  details?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseSuccess<T>(body: unknown): T {
  // Format SDD 5.5: { success: true, data: ... }
  if (isRecord(body) && body.success === true && 'data' in body) {
    return body.data as T;
  }
  // Format backend saat ini: JSON mentah.
  return body as T;
}

export function parseErrorBody(body: unknown): ParsedErrorBody {
  if (!isRecord(body)) return {};

  // Format SDD 5.5: { success: false, errorCode, message, details? }
  // [ASUMSI] nama field detail validasi di SDD: `details` atau `errors`.
  if (body.success === false || typeof body.errorCode === 'string') {
    return {
      serverMessage: typeof body.message === 'string' ? body.message : undefined,
      code: typeof body.errorCode === 'string' ? body.errorCode : undefined,
      details: body.details ?? body.errors,
    };
  }

  // Format NestJS: { statusCode, message: string | string[], error }
  if (Array.isArray(body.message)) {
    const messages = body.message.filter((item): item is string => typeof item === 'string');
    return { serverMessage: messages.join('; '), details: messages };
  }
  if (typeof body.message === 'string') {
    return { serverMessage: body.message };
  }

  return {};
}
