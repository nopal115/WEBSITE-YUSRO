// Bentuk respons tiruan mengikuti format standar SDD 5.5.
import type { PageMeta } from '../responseFormat';

export interface MockRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  params: Record<string, string>;
  headers: Record<string, string>;
  body: unknown;
  userId: string | null;
}

export interface MockResult {
  status: number;
  body?: unknown;
  blob?: Blob;
  headers?: Record<string, string>;
}

export function ok(data: unknown, options: { message?: string; meta?: PageMeta | null; status?: number } = {}): MockResult {
  const { message = 'Berhasil', meta = null, status = 200 } = options;
  return { status, body: { success: true, message, data, meta } };
}

export function fail(status: number, errorCode: string, message: string, errors?: { field: string; message: string }[]): MockResult {
  return { status, body: { success: false, message, errorCode, ...(errors ? { errors } : {}) } };
}

/** Dilempar handler untuk menghentikan proses dengan respons galat. */
export class MockHttpError extends Error {
  constructor(readonly result: MockResult) {
    super(`Mock HTTP ${result.status}`);
  }
}

export function httpError(...args: Parameters<typeof fail>): MockHttpError {
  return new MockHttpError(fail(...args));
}

export function paginate<T>(items: T[], query: URLSearchParams, defaultLimit: number): { data: T[]; meta: PageMeta } {
  const limit = Math.max(1, Number(query.get('limit')) || defaultLimit);
  const page = Math.max(1, Number(query.get('page')) || 1);
  const totalPages = Math.max(1, Math.ceil(items.length / limit));
  return { data: items.slice((page - 1) * limit, page * limit), meta: { page, limit, total: items.length, totalPages } };
}

export function toResponse(result: MockResult): Response {
  if (result.blob) return new Response(result.blob, { status: result.status, headers: result.headers });
  const body = result.body === undefined ? null : JSON.stringify({ ...(result.body as object), requestId: crypto.randomUUID(), timestamp: new Date().toISOString() });
  return new Response(body, { status: result.status, headers: { 'Content-Type': 'application/json', ...result.headers } });
}
