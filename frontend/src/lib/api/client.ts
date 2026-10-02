import { tokenStore } from '../auth/tokenStore';
import { createApiError, createNetworkError } from './ApiError';
import { parseSuccess, parseSuccessWithMeta, type ParsedSuccess } from './responseFormat';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  /** Objek dikirim sebagai JSON; FormData dikirim sebagai multipart/form-data. */
  body?: unknown;
  headers?: Record<string, string>;
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

/** Hasil unduhan berkas (responseType blob), mis. laporan PDF. */
export interface BlobResult {
  blob: Blob;
  filename: string | null;
}

function filenameFromDisposition(header: string | null): string | null {
  const match = header ? /filename="?([^";]+)"?/i.exec(header) : null;
  return match ? match[1] : null;
}

/** Mengirim request dan mengembalikan Response yang sukses; galat diubah menjadi ApiError. */
async function send(path: string, options: RequestOptions): Promise<Response> {
  const { method = 'GET', body, auth = true, signal } = options;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;

  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  const token = auth ? tokenStore.get() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  // FormData: browser mengisi Content-Type multipart beserta boundary-nya sendiri.
  const requestBody = body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body);

  // Mode mock (pengembangan saja). VITE_USE_MOCK diganti menjadi literal saat build
  // (vite.config.ts), sehingga cabang mock dan import() modulnya terbuang bila flag mati.
  // Perbandingan harus ditulis langsung di kondisi agar Rollup bisa membuangnya.
  const url = import.meta.env.VITE_USE_MOCK === 'true' ? '' : `${getBaseUrl()}/${path.replace(/^\/+/, '')}`;

  let response: Response;
  try {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      const { mockFetch } = await import('./mock');
      response = await mockFetch(method, path, { headers, body: requestBody });
    } else {
      response = await fetch(url, { method, headers, body: requestBody, signal });
    }
  } catch (error) {
    // Pembatalan (mis. oleh TanStack Query) diteruskan apa adanya.
    if (isAbortError(error)) throw error;
    throw createNetworkError(error);
  }

  if (!response.ok) {
    const payload = await readBody(response);
    if (response.status === 401 && auth) {
      tokenStore.clear();
      unauthorizedHandler?.();
    }
    throw createApiError(response.status, payload);
  }
  return response;
}

/** Mengembalikan field data dari respons (SDD 5.5). */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return parseSuccess<T>(await readBody(await send(path, options)));
}

/** Seperti apiRequest, ditambah meta pagination (SDD 5.5). */
export async function apiRequestWithMeta<T>(path: string, options: RequestOptions = {}): Promise<ParsedSuccess<T>> {
  return parseSuccessWithMeta<T>(await readBody(await send(path, options)));
}

/** Mengunduh berkas; nama berkas diambil dari Content-Disposition bila ada. */
export async function apiRequestBlob(path: string, options: RequestOptions = {}): Promise<BlobResult> {
  const response = await send(path, options);
  return { blob: await response.blob(), filename: filenameFromDisposition(response.headers.get('Content-Disposition')) };
}
