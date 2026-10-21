import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  ArgumentsHost,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  function createMockHost(headers: Record<string, string> = {}) {
    const statusFn = jest.fn().mockReturnThis();
    const jsonFn = jest.fn();
    const setHeaderFn = jest.fn();

    const request = { headers };
    const response = {
      status: statusFn,
      json: jsonFn,
      setHeader: setHeaderFn,
    };

    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;

    return { host, statusFn, jsonFn, setHeaderFn };
  }

  it('menerjemahkan ConflictException dengan kode khusus ke format SDD 11.4', () => {
    const { host, statusFn, jsonFn } = createMockHost({ 'x-request-id': 'req-conflict-123' });
    const exception = new ConflictException('AUTH_EMAIL_TAKEN');

    filter.catch(exception, host);

    expect(statusFn).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errorCode: 'AUTH_EMAIL_TAKEN',
        message: 'Email sudah terdaftar. Gunakan email lain atau masuk.',
        requestId: 'req-conflict-123',
        timestamp: expect.any(String),
      }),
    );
  });

  it('menerjemahkan array pesan validasi dari class-validator menjadi array errors per kolom', () => {
    const { host, statusFn, jsonFn } = createMockHost();
    const exception = new BadRequestException([
      'email must be an email',
      'password must be longer than or equal to 8 characters',
    ]);

    filter.catch(exception, host);

    expect(statusFn).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Data yang dikirim belum lengkap atau tidak valid.',
        errors: [
          { field: 'email', message: 'email must be an email' },
          { field: 'password', message: 'password must be longer than or equal to 8 characters' },
        ],
      }),
    );
  });

  it('menangani unhandled error dengan pesan aman tanpa membocorkan stack trace', () => {
    const { host, statusFn, jsonFn } = createMockHost();
    const exception = new Error('Database connection failed: select * from secret_table');

    filter.catch(exception, host);

    expect(statusFn).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errorCode: 'INTERNAL_ERROR',
        message: 'Terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi.',
      }),
    );
  });
});
