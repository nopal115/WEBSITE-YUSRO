import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../../auth/tokenStore';
import { ApiError } from '../ApiError';
import { apiRequest, apiRequestBlob, apiRequestWithMeta, setUnauthorizedHandler } from '../client';

const BASE_URL = 'http://localhost:3000/api/v1';

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const fetchMock = vi.fn<typeof fetch>();

function lastRequestHeaders(): Record<string, string> {
  const init = fetchMock.mock.lastCall?.[1];
  return (init?.headers ?? {}) as Record<string, string>;
}

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', BASE_URL);
  vi.stubGlobal('sessionStorage', createMemoryStorage());
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  tokenStore.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('menyusun URL dari VITE_API_BASE_URL dan mem-parse JSON', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: '1', name: 'Budi' }));

    const result = await apiRequest<{ id: string; name: string }>('/auth/me');

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE_URL}/auth/me`);
    expect(result).toEqual({ id: '1', name: 'Budi' });
  });

  it('memasang header Authorization Bearer bila ada token', async () => {
    tokenStore.set('token-abc');
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await apiRequest('auth/me');

    expect(lastRequestHeaders().Authorization).toBe('Bearer token-abc');
  });

  it('tidak memasang Authorization bila tidak ada token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await apiRequest('auth/me');

    expect(lastRequestHeaders().Authorization).toBeUndefined();
  });

  it('tidak memasang Authorization pada request publik (auth: false)', async () => {
    tokenStore.set('token-abc');
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await apiRequest('auth/login', { method: 'POST', body: { email: 'a@b.c', password: 'x' }, auth: false });

    const init = fetchMock.mock.calls[0][1];
    expect(lastRequestHeaders().Authorization).toBeUndefined();
    expect(lastRequestHeaders()['Content-Type']).toBe('application/json');
    expect(init?.body).toBe(JSON.stringify({ email: 'a@b.c', password: 'x' }));
  });

  it('saat 401 pada request terautentikasi: hapus token dan panggil handler', async () => {
    const handler = vi.fn();
    const unregister = setUnauthorizedHandler(handler);
    tokenStore.set('expired-token');
    fetchMock.mockResolvedValue(jsonResponse(401, { statusCode: 401, message: 'Unauthorized' }));

    await expect(apiRequest('auth/me')).rejects.toMatchObject({ status: 401 });

    expect(tokenStore.get()).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
    unregister();
  });

  it('saat 401 pada request publik (login): tidak hapus token dan tidak redirect', async () => {
    const handler = vi.fn();
    const unregister = setUnauthorizedHandler(handler);
    tokenStore.set('token-lama');
    fetchMock.mockResolvedValue(jsonResponse(401, { statusCode: 401, message: 'Invalid email or password' }));

    await expect(apiRequest('auth/login', { method: 'POST', body: {}, auth: false })).rejects.toBeInstanceOf(ApiError);

    expect(tokenStore.get()).toBe('token-lama');
    expect(handler).not.toHaveBeenCalled();
    unregister();
  });

  it('mengubah error non-2xx menjadi ApiError', async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, { statusCode: 403, message: 'Forbidden' }));

    const error = await apiRequest('monitoring').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
  });

  it('mengubah kegagalan jaringan menjadi ApiError status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(apiRequest('auth/me')).rejects.toMatchObject({ status: 0, isNetworkError: true });
  });

  it('meneruskan AbortError apa adanya', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    fetchMock.mockRejectedValue(abortError);

    await expect(apiRequest('auth/me')).rejects.toBe(abortError);
  });

  it('menangani response tanpa body (204)', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiRequest('something', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('melempar error jelas bila VITE_API_BASE_URL kosong', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');

    await expect(apiRequest('auth/me')).rejects.toThrow('VITE_API_BASE_URL belum diisi');
    expect(fetchMock).not.toHaveBeenCalled();
  });
it('mengirim FormData tanpa Content-Type manual dan meneruskan header tambahan', async () => {
    fetchMock.mockResolvedValue(jsonResponse(202, { success: true, data: { submissionId: 's1' } }));
    const form = new FormData();
    form.append('audio_file', new Blob(['x'], { type: 'audio/webm' }));

    await apiRequest('imitation/tasks/t1/submissions', { method: 'POST', body: form, headers: { 'Idempotency-Key': 'k1' } });

    const init = fetchMock.mock.lastCall?.[1];
    expect(init?.body).toBe(form);
    expect(lastRequestHeaders()['Content-Type']).toBeUndefined();
    expect(lastRequestHeaders()['Idempotency-Key']).toBe('k1');
  });

  it('apiRequestWithMeta mengembalikan data dan meta', async () => {
    const meta = { page: 2, limit: 10, total: 11, totalPages: 2 };
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: [{ id: 'a' }], meta }));

    await expect(apiRequestWithMeta('progress/history?page=2')).resolves.toEqual({ data: [{ id: 'a' }], meta, message: null });
  });

  it('apiRequestBlob mengembalikan berkas dan nama dari Content-Disposition', async () => {
    fetchMock.mockResolvedValue(
      new Response(new Blob(['%PDF'], { type: 'application/pdf' }), {
        status: 200,
        headers: { 'Content-Disposition': 'attachment; filename="Laporan-YSR-000001-2026-10-02.pdf"' },
      }),
    );

    const result = await apiRequestBlob('report/pdf');

    expect(result.filename).toBe('Laporan-YSR-000001-2026-10-02.pdf');
    expect(await result.blob.text()).toBe('%PDF');
  });
});
