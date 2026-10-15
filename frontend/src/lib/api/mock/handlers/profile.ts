// SDD 5.7.
import type { Profile } from '../../../../features/profile/types';
import { findUser, type MockUser } from '../db';
import { fail, ok } from '../http';
import type { MockRoute } from '../router';
import { assertName, assertNewPassword } from './auth';

const toProfile = (user: MockUser): Profile => ({
  studentCode: user.studentCode ?? '',
  name: user.name,
  email: user.email,
  status: user.status,
  joinedAt: user.joinedAt,
});

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});

export const profileRoutes: MockRoute[] = [
  { method: 'GET', pattern: '/profile', access: 'SANTRI', handler: (req) => ok(toProfile(findUser(req.userId))) },
  {
    method: 'PATCH',
    pattern: '/profile',
    access: 'SANTRI',
    handler: (req) => {
      const input = record(req.body);
      // Field selain name ditolak, bukan diabaikan diam-diam (SDD 5.7).
      const extra = Object.keys(input).filter((key) => key !== 'name');
      if (extra.length > 0) {
        return fail(422, 'VALIDATION_ERROR', 'Hanya nama yang dapat diubah.', extra.map((field) => ({ field, message: 'Field ini tidak dapat diubah.' })));
      }
      const name = typeof input.name === 'string' ? input.name : '';
      assertName(name);
      const user = findUser(req.userId);
      user.name = name.trim();
      return ok(toProfile(user), { message: 'Profil diperbarui.' });
    },
  },
  {
    method: 'PATCH',
    pattern: '/profile/password',
    access: 'SANTRI',
    handler: (req) => {
      const { currentPassword, password, passwordConfirmation } = record(req.body);
      const user = findUser(req.userId);
      // [ASUMSI] Kode galat password lama yang salah tidak dirinci SDD.
      if (currentPassword !== user.password) {
        return fail(422, 'VALIDATION_ERROR', 'Password saat ini salah.', [{ field: 'currentPassword', message: 'Password saat ini salah.' }]);
      }
      assertNewPassword(String(password ?? ''), String(passwordConfirmation ?? ''));
      user.password = String(password);
      return ok(null, { message: 'Password berhasil diubah.' });
    },
  },
];
