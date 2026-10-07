// SDD 5.6 dan aturan validasi SDD 3.2.6 / 3.2.7.
import type { User } from '../../../../features/auth/types';
import { isRevoked, revokeToken } from '../controls';
import { db, findUser, type MockUser } from '../db';
import { fail, httpError, ok, type MockRequest } from '../http';
import type { MockIdentity, MockRoute } from '../router';

type Body = Record<string, unknown>;

const NAME_RULE = /^[\p{L}\s'-]{3,100}$/u;
const PASSWORD_RULE = /^(?=.*\p{L})(?=.*\d).{8,}$/u;
/** [ASUMSI] Token reset tiruan; tautan reset asli dikirim lewat email. */
export const MOCK_RESET_TOKEN = 'mock-reset-token';

export const toAuthUser = (user: MockUser) => ({ id: user.id, studentCode: user.studentCode, name: user.name, role: user.role, status: user.status });
export const toUser = (user: MockUser): User => ({ ...toAuthUser(user), email: user.email });

const body = (req: MockRequest): Body => (req.body && typeof req.body === 'object' ? (req.body as Body) : {});
const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const bearer = (req: MockRequest): string | null => req.headers.Authorization?.replace(/^Bearer\s+/i, '') ?? null;

/** Token tiruan: mock.<userId>.<acak>. Bertahan saat reload karena tidak disimpan di memori. */
export function resolveIdentity(token: string): MockIdentity | null {
  const [prefix, userId] = token.split('.');
  if (prefix !== 'mock' || isRevoked(token)) return null;
  const user = db.users.find((item) => item.id === userId);
  return user ? { id: user.id, role: user.role, status: user.status } : null;
}

/** Memvalidasi password baru + konfirmasinya (SDD 3.2.6). */
export function assertNewPassword(password: string, confirmation: string): void {
  if (!PASSWORD_RULE.test(password)) {
    throw httpError(422, 'AUTH_WEAK_PASSWORD', 'Password minimal 8 karakter dan memuat huruf serta angka.');
  }
  if (password !== confirmation) {
    throw httpError(422, 'VALIDATION_ERROR', 'Konfirmasi password tidak sama.', [
      { field: 'passwordConfirmation', message: 'Konfirmasi password tidak sama.' },
    ]);
  }
}

export function assertName(name: string): void {
  if (!NAME_RULE.test(name.trim())) {
    throw httpError(422, 'VALIDATION_ERROR', 'Nama tidak valid.', [
      { field: 'name', message: 'Nama 3–100 karakter, hanya huruf, spasi, tanda hubung, dan apostrof.' },
    ]);
  }
}

export const authRoutes: MockRoute[] = [
  {
    method: 'POST',
    pattern: '/auth/register',
    access: 'public',
    handler: (req) => {
      const { name, email, password, passwordConfirmation } = body(req);
      const normalizedEmail = text(email).trim().toLowerCase();
      assertName(text(name));
      if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
        return fail(422, 'VALIDATION_ERROR', 'Email tidak valid.', [{ field: 'email', message: 'Format email tidak valid.' }]);
      }
      if (db.users.some((user) => user.email === normalizedEmail)) {
        return fail(409, 'AUTH_EMAIL_TAKEN', 'Email sudah terdaftar. Gunakan email lain atau masuk.');
      }
      assertNewPassword(text(password), text(passwordConfirmation));
      const user: MockUser = {
        id: `usr-${crypto.randomUUID().slice(0, 8)}`,
        studentCode: `YSR-${String(db.users.length + 1).padStart(6, '0')}`,
        name: text(name).trim(),
        email: normalizedEmail,
        password: text(password),
        role: 'SANTRI',
        status: 'ACTIVE',
        joinedAt: new Date().toISOString(),
      };
      db.users.push(user);
      return ok(toUser(user), { status: 201, message: 'Akun berhasil dibuat. Silakan masuk.' });
    },
  },
  {
    method: 'POST',
    pattern: '/auth/login',
    access: 'public',
    handler: (req) => {
      const { email, password } = body(req);
      const user = db.users.find((item) => item.email === text(email).trim().toLowerCase());
      if (!user || user.password !== text(password)) {
        return fail(401, 'AUTH_INVALID_CREDENTIALS', 'Email atau password salah.');
      }
      if (user.status !== 'ACTIVE') return fail(403, 'AUTH_ACCOUNT_INACTIVE', 'Akun Anda dinonaktifkan. Hubungi pengajar.');
      const accessToken = `mock.${user.id}.${crypto.randomUUID().slice(0, 8)}`;
      return ok({ accessToken, expiresIn: 900, user: toAuthUser(user) }, { message: 'Berhasil masuk' });
    },
  },
  {
    method: 'POST',
    pattern: '/auth/logout',
    access: 'any',
    handler: (req) => {
      const token = bearer(req);
      if (token) revokeToken(token);
      return ok(null, { message: 'Berhasil keluar.' });
    },
  },
  {
    method: 'POST',
    pattern: '/auth/forgot-password',
    access: 'public',
    // Respons selalu sama, apa pun kenyataannya (SDD 5.6).
    handler: () => ok(null, { message: 'Jika email terdaftar, tautan reset telah dikirim.' }),
  },
  {
    method: 'POST',
    pattern: '/auth/reset-password',
    access: 'public',
    handler: (req) => {
      const { token, password, passwordConfirmation } = body(req);
      if (token !== MOCK_RESET_TOKEN) return fail(400, 'AUTH_RESET_INVALID', 'Tautan reset tidak berlaku. Silakan minta tautan baru.');
      assertNewPassword(text(password), text(passwordConfirmation));
      // [ASUMSI] Token reset tiruan berlaku untuk akun Santri contoh.
      findUser('usr-santri').password = text(password);
      return ok(null, { message: 'Password berhasil diubah. Silakan masuk.' });
    },
  },
  {
    method: 'GET',
    pattern: '/auth/me',
    access: 'any',
    handler: (req) => ok(toUser(findUser(req.userId))),
  },
];
