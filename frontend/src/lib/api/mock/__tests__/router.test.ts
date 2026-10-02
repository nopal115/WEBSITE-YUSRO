import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockControls } from '../controls';
import { ok } from '../http';
import { createMockFetch, matchRoute, type MockRoute } from '../router';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

const routes: MockRoute[] = [
  { method: 'GET', pattern: '/learning/stages/:stageId/materials', access: 'SANTRI', handler: (req) => ok({ stageId: req.params.stageId, page: req.query.get('page') }) },
  { method: 'POST', pattern: '/auth/login', access: 'public', handler: (req) => ok(req.body) },
];

const identities: Record<string, { id: string; role: 'SANTRI' | 'ADMIN' }> = {
  santri: { id: 'u1', role: 'SANTRI' },
  admin: { id: 'u2', role: 'ADMIN' },
};
const mockFetch = createMockFetch(routes, (token) => identities[token] ?? null);
const auth = (token: string) => ({ headers: { Authorization: `Bearer ${token}` }, body: undefined });

beforeEach(() => {
  vi.stubGlobal('sessionStorage', memoryStorage());
  mockControls.reset();
  mockControls.setDelay(0);
});

describe('matchRoute', () => {
  it('mencocokkan method, pola path, dan mengambil parameter', () => {
    expect(matchRoute(routes, 'GET', '/learning/stages/stg-l001/materials')?.params).toEqual({ stageId: 'stg-l001' });
    expect(matchRoute(routes, 'POST', '/learning/stages/stg-l001/materials')).toBeNull();
    expect(matchRoute(routes, 'GET', '/learning/stages')).toBeNull();
  });
});

describe('createMockFetch', () => {
  it('membungkus data dengan format SDD 5.5 dan meneruskan query', async () => {
    const response = await mockFetch('GET', 'learning/stages/stg-l002/materials?page=2', auth('santri'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, message: 'Berhasil', data: { stageId: 'stg-l002', page: '2' }, meta: null });
    expect(typeof body.requestId).toBe('string');
  });

  it('mem-parse body JSON pada endpoint publik tanpa token', async () => {
    const response = await mockFetch('POST', 'auth/login', { headers: {}, body: JSON.stringify({ email: 'a@b.c' }) });
    expect((await response.json()).data).toEqual({ email: 'a@b.c' });
  });

  it('menjawab 404 untuk endpoint yang tidak ditiru', async () => {
    const response = await mockFetch('GET', 'admin/students', auth('santri'));
    expect(response.status).toBe(404);
    expect((await response.json()).errorCode).toBe('NOT_FOUND');
  });

  it('menjawab 401 tanpa token yang valid dan 403 untuk peran selain Santri', async () => {
    expect((await mockFetch('GET', 'learning/stages/x/materials', { headers: {}, body: undefined })).status).toBe(401);
    expect((await mockFetch('GET', 'learning/stages/x/materials', auth('admin'))).status).toBe(403);
  });

  it('failNext menghasilkan status galat sekali saja untuk pola yang cocok', async () => {
    mockControls.failNext(500, 'GET learning/*');

    const failed = await mockFetch('GET', 'learning/stages/x/materials', auth('santri'));
    expect(failed.status).toBe(500);
    expect((await failed.json()).success).toBe(false);
    expect((await mockFetch('GET', 'learning/stages/x/materials', auth('santri'))).status).toBe(200);
  });

  it('failNext("network") membuat fetch tiruan gagal seperti jaringan putus', async () => {
    mockControls.failNext('network');
    await expect(mockFetch('POST', 'auth/login', { headers: {}, body: '{}' })).rejects.toBeInstanceOf(TypeError);
  });
});
