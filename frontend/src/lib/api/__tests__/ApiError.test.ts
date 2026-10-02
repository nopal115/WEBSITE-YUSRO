import { describe, expect, it } from 'vitest';
import { ApiError, createApiError, createNetworkError, userMessageForStatus } from '../ApiError';
import { parseSuccess, parseSuccessWithMeta } from '../responseFormat';

describe('createApiError', () => {
  it('membaca format error NestJS dengan message string', () => {
    const error = createApiError(401, { statusCode: 401, message: 'Invalid email or password', error: 'Unauthorized' });

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
    expect(error.serverMessage).toBe('Invalid email or password');
    expect(error.code).toBeUndefined();
    expect(error.message).toBe(userMessageForStatus(401));
  });

  it('membaca format error NestJS dengan message array (validasi)', () => {
    const error = createApiError(400, {
      statusCode: 400,
      message: ['email must be an email', 'password should not be empty'],
      error: 'Bad Request',
    });

    expect(error.serverMessage).toBe('email must be an email; password should not be empty');
    expect(error.details).toEqual(['email must be an email', 'password should not be empty']);
  });

  it('membaca format error SDD 5.5 dan memakai message server sebagai pesan pengguna', () => {
    const errors = [{ field: 'audio_file', message: 'Format tidak didukung.' }];
    const error = createApiError(409, {
      success: false,
      message: 'Masih ada rekaman yang sedang dievaluasi untuk tugas ini.',
      errorCode: 'IMITATION_ACTIVE_EXISTS',
      errors,
    });

    expect(error.status).toBe(409);
    expect(error.code).toBe('IMITATION_ACTIVE_EXISTS');
    expect(error.message).toBe('Masih ada rekaman yang sedang dievaluasi untuk tugas ini.');
    expect(error.details).toEqual(errors);
  });

  it('memperlakukan 415 tanpa errorCode sebagai AUDIO_FORMAT_UNSUPPORTED', () => {
    const error = createApiError(415, undefined);

    expect(error.code).toBe('AUDIO_FORMAT_UNSUPPORTED');
    expect(error.message).toBe(userMessageForStatus(415));
  });

  it('tetap menghasilkan ApiError bila body bukan JSON atau kosong', () => {
    expect(createApiError(502, '<html>Bad Gateway</html>').serverMessage).toBeUndefined();
    expect(createApiError(500, undefined).message).toBe(userMessageForStatus(500));
  });

  it('menandai kegagalan jaringan dengan status 0', () => {
    const error = createNetworkError(new TypeError('Failed to fetch'));

    expect(error.status).toBe(0);
    expect(error.isNetworkError).toBe(true);
  });
});

describe('userMessageForStatus', () => {
  it.each([0, 400, 401, 403, 404, 409, 422, 429, 500, 503])('memberi pesan khusus untuk status %i', (status) => {
    expect(userMessageForStatus(status)).not.toBe(userMessageForStatus(418));
  });

  it('memakai pesan server untuk seluruh 5xx', () => {
    expect(userMessageForStatus(503)).toBe(userMessageForStatus(500));
  });
});

describe('parseSuccess', () => {
  it('mengembalikan JSON mentah (format backend saat ini)', () => {
    const body = { accessToken: 't', user: { id: '1' } };
    expect(parseSuccess(body)).toBe(body);
  });

  it('membuka amplop SDD 5.5 { success, data }', () => {
    expect(parseSuccess({ success: true, data: { id: '1' } })).toEqual({ id: '1' });
  });

  it('mengembalikan meta pagination SDD 5.5', () => {
    const meta = { page: 1, limit: 20, total: 137, totalPages: 7 };
    expect(parseSuccessWithMeta({ success: true, data: [], meta })).toEqual({ data: [], meta });
    expect(parseSuccessWithMeta({ success: true, data: [], meta: null }).meta).toBeNull();
  });
});
