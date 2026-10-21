// SDD 5.7. Telepon dan foto: PROPOSED API CONTRACT - sinkronkan dengan backend.
import type { Profile } from '../../../../features/profile/types';
import { isValidIndonesianPhone, normalizePhone, validateAvatarFile } from '../../../../features/profile/validation';
import { findUser, type MockUser } from '../db';
import { fail, ok } from '../http';
import type { MockRoute } from '../router';
import { assertName, assertNewPassword } from './auth';

const toProfile = (user: MockUser): Profile => ({
  id: user.id,
  studentCode: user.studentCode ?? '',
  name: user.name,
  email: user.email,
  phone: user.phone ?? null,
  avatarUrl: user.avatarUrl ?? null,
  status: user.status,
  joinedAt: user.joinedAt,
});

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});
const EDITABLE = ['name', 'phone'];

export const profileRoutes: MockRoute[] = [
  { method: 'GET', pattern: '/profile', access: 'SANTRI', handler: (req) => ok(toProfile(findUser(req.userId))) },
  {
    method: 'PATCH',
    pattern: '/profile',
    access: 'SANTRI',
    handler: (req) => {
      const input = record(req.body);
      // Field selain name dan phone ditolak, bukan diabaikan diam-diam (SDD 5.7).
      const extra = Object.keys(input).filter((key) => !EDITABLE.includes(key));
      if (extra.length > 0) {
        return fail(422, 'VALIDATION_ERROR', 'Hanya nama dan nomor telepon yang dapat diubah.', extra.map((field) => ({ field, message: 'Field ini tidak dapat diubah.' })));
      }
      const name = typeof input.name === 'string' ? input.name : '';
      assertName(name);
      const phone = input.phone === null || input.phone === undefined || input.phone === '' ? null : String(input.phone);
      if (phone !== null && !isValidIndonesianPhone(phone)) {
        return fail(422, 'VALIDATION_ERROR', 'Data belum valid.', [{ field: 'phone', message: 'Nomor telepon tidak valid. Gunakan format 08xx atau +628xx, 10–15 digit.' }]);
      }
      const user = findUser(req.userId);
      user.name = name.trim();
      user.phone = phone === null ? null : normalizePhone(phone);
      return ok(toProfile(user), { message: 'Profil diperbarui.' });
    },
  },
  {
    // Multipart field "file".
    method: 'POST',
    pattern: '/profile/avatar',
    access: 'SANTRI',
    handler: (req) => {
      const file = typeof FormData !== 'undefined' && req.body instanceof FormData ? req.body.get('file') : null;
      if (!(file instanceof Blob)) return fail(422, 'VALIDATION_ERROR', 'Data belum lengkap.', [{ field: 'file', message: 'Pilih foto.' }]);
      const invalid = validateAvatarFile(file);
      if (invalid) return fail(422, 'VALIDATION_ERROR', invalid, [{ field: 'file', message: invalid }]);
      const user = findUser(req.userId);
      // [DATA CONTOH] Mock menyimpan foto sebagai object URL di memori; hilang saat halaman dimuat ulang.
      user.avatarUrl = URL.createObjectURL(file);
      return ok({ avatarUrl: user.avatarUrl }, { status: 201, message: 'Foto profil diperbarui.' });
    },
  },
  {
    method: 'DELETE',
    pattern: '/profile/avatar',
    access: 'SANTRI',
    handler: (req) => {
      findUser(req.userId).avatarUrl = null;
      return { status: 204 };
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
