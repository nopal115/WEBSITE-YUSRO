// Meneruskan request ke handler tiruan berdasarkan method + path, dan menghasilkan Response
// seperti backend sungguhan sehingga client dan kode fitur tidak tahu sedang memakai mock.
import { getDelay, takeFault } from './controls';
import { fail, MockHttpError, toResponse, type MockRequest, type MockResult } from './http';

/** public: tanpa token; any: semua peran; SANTRI: hanya Santri (endpoint admin tidak ditiru). */
export type RouteAccess = 'public' | 'any' | 'SANTRI';

export interface MockRoute {
  method: string;
  pattern: string;
  access: RouteAccess;
  handler: (request: MockRequest) => MockResult | Promise<MockResult>;
}

export interface MockIdentity {
  id: string;
  role: 'SANTRI' | 'ADMIN';
}

export interface MockFetchInit {
  headers: Record<string, string>;
  body: unknown;
}

function splitPath(path: string): string[] {
  return path.split('/').filter(Boolean);
}

export function matchRoute(routes: MockRoute[], method: string, path: string): { route: MockRoute; params: Record<string, string> } | null {
  const segments = splitPath(path);
  for (const route of routes) {
    if (route.method !== method) continue;
    const pattern = splitPath(route.pattern);
    if (pattern.length !== segments.length) continue;
    const params: Record<string, string> = {};
    const matched = pattern.every((part, index) => {
      if (part.startsWith(':')) {
        params[part.slice(1)] = decodeURIComponent(segments[index]);
        return true;
      }
      return part === segments[index];
    });
    if (matched) return { route, params };
  }
  return null;
}

async function parseBody(body: unknown): Promise<unknown> {
  if (typeof body !== 'string') return body; // FormData atau undefined
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

export function createMockFetch(routes: MockRoute[], resolveIdentity: (token: string) => MockIdentity | null) {
  return async function mockFetch(method: string, rawPath: string, init: MockFetchInit): Promise<Response> {
    const delay = getDelay();
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

    const url = new URL(rawPath.replace(/^\/+/, ''), 'http://mock.local/');
    const path = url.pathname;
    const fault = takeFault(`${method} ${path.replace(/^\//, '')}`);
    if (fault === 'network') throw new TypeError('Failed to fetch (simulasi mode mock)');
    if (fault !== null) return toResponse(fail(fault, `MOCK_${fault}`, `Simulasi galat ${fault} dari mode mock.`));

    const found = matchRoute(routes, method, path);
    if (!found) return toResponse(fail(404, 'NOT_FOUND', 'Endpoint tiruan belum tersedia.'));

    const token = init.headers.Authorization?.replace(/^Bearer\s+/i, '') ?? null;
    const identity = token ? resolveIdentity(token) : null;
    if (found.route.access !== 'public' && !identity) {
      return toResponse(fail(401, 'AUTH_TOKEN_EXPIRED', 'Sesi berakhir. Silakan masuk kembali.'));
    }
    if (found.route.access === 'SANTRI' && identity?.role !== 'SANTRI') {
      return toResponse(fail(403, 'FORBIDDEN_ROLE', 'Anda tidak memiliki akses ke data ini.'));
    }

    const request: MockRequest = {
      method,
      path,
      query: url.searchParams,
      params: found.params,
      headers: init.headers,
      body: await parseBody(init.body),
      userId: identity?.id ?? null,
    };
    try {
      return toResponse(await found.route.handler(request));
    } catch (error) {
      if (error instanceof MockHttpError) return toResponse(error.result);
      throw error;
    }
  };
}
