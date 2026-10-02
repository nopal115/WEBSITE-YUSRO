import { tokenStore } from '../auth/tokenStore';
import { createApiError, createNetworkError } from './ApiError';
import { parseSuccess } from './responseFormat';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  /** false untuk endpoint publik (mis. login): tanpa Bearer dan tanpa redirect saat 401. */
  auth?: boolean;
  signal?: AbortSignal;
}

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Didaftarkan sekali di AppProviders; dipanggil saat request terautentikasi mendapat 401. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): () => void {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

function getBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL belum diisi. Salin frontend/.env.example menjadi frontend/.env lalu isi nilainya.');
  }
  return baseUrl.replace(/\/+$/, '');
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = options;
  const url = `${getBaseUrl()}/${path.replace(/^\/+/, '')}`;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth ? tokenStore.get() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    // Pembatalan (mis. oleh TanStack Query) diteruskan apa adanya.
    if (isAbortError(error)) throw error;
    throw createNetworkError(error);
  }

  const payload = await readBody(response);

  if (!response.ok) {
    if (response.status === 401 && auth) {
      tokenStore.clear();
      unauthorizedHandler?.();
    }
    throw createApiError(response.status, payload);
  }

  return parseSuccess<T>(payload);
}
