import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { TransformResponseInterceptor } from './transform-response.interceptor';

describe('TransformResponseInterceptor', () => {
  let interceptor: TransformResponseInterceptor<any>;

  beforeEach(() => {
    interceptor = new TransformResponseInterceptor();
  });

  function createMockContext(headers: Record<string, string> = {}) {
    const responseHeaders: Record<string, string> = {};
    const request = {
      headers,
    };
    const response = {
      setHeader: jest.fn((k: string, v: string) => {
        responseHeaders[k.toLowerCase()] = v;
      }),
      getHeader: jest.fn((k: string) => responseHeaders[k.toLowerCase()]),
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;

    return { context, response, responseHeaders };
  }

  it('membungkus payload objek biasa ke dalam amplop SDD 5.5', (done) => {
    const { context, response } = createMockContext({ 'x-request-id': 'custom-req-id' });
    const callHandler: CallHandler = {
      handle: () => of({ foo: 'bar' }),
    };

    interceptor.intercept(context, callHandler).subscribe((result: any) => {
      expect(result.success).toBe(true);
      expect(result.message).toBe('Berhasil');
      expect(result.data).toEqual({ foo: 'bar' });
      expect(result.meta).toBeNull();
      expect(result.requestId).toBe('custom-req-id');
      expect(result.timestamp).toBeDefined();
      expect(response.setHeader).toHaveBeenCalledWith('X-Request-Id', 'custom-req-id');
      done();
    });
  });

  it('memisahkan data dan meta bila controller mengembalikan objek dengan properti meta', (done) => {
    const { context } = createMockContext();
    const callHandler: CallHandler = {
      handle: () =>
        of({
          data: [{ id: 1 }, { id: 2 }],
          meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
        }),
    };

    interceptor.intercept(context, callHandler).subscribe((result: any) => {
      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
      expect(result.meta).toEqual({ page: 1, limit: 10, total: 2, totalPages: 1 });
      done();
    });
  });

  it('mempertahankan buffer berkas biner tanpa membungkusnya', (done) => {
    const { context } = createMockContext();
    const buffer = Buffer.from('PDF_CONTENT');
    const callHandler: CallHandler = {
      handle: () => of(buffer),
    };

    interceptor.intercept(context, callHandler).subscribe((result: any) => {
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result).toBe(buffer);
      done();
    });
  });
});
