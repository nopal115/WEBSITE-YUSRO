import { describe, expect, it } from 'vitest';
import { ApiError, createApiError, createNetworkError, userMessageForStatus } from '../ApiError';
import { parseSuccess } from '../responseFormat';

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

  it('membaca format error SDD 5.5 (success/errorCode)', () => {
    const error = createApiError(409, {
      success: false,
      errorCode: 'IMITATION_ACTIVE_EXISTS',
      message: 'Evaluation already active',
      details: { taskId: 'abc' },
    });

    expect(error.status).toBe(409);
    expect(error.code).toBe('IMITATION_ACTIVE_EXISTS');
    expect(error.serverMessage).toBe('Evaluation already active');
    expect(error.details).toEqual({ taskId: 'abc' });
    expect(error.message).toBe(userMessageForStatus(409));
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
});
