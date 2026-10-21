import { z } from 'zod';
import { nameSchema } from '../auth/authSchemas';

/** [TBD] Format dan ukuran foto profil belum diatur SRS/SDD; disepakati dengan backend lalu ubah di sini saja. */
export const AVATAR_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** Pesan galat foto sebelum diunggah, atau null bila boleh dikirim. */
export function validateAvatarFile(file: Pick<File, 'type' | 'size'>): string | null {
  if (!(AVATAR_ACCEPTED_TYPES as readonly string[]).includes(file.type)) return 'Foto harus berformat JPG, PNG, atau WebP.';
  if (file.size > AVATAR_MAX_BYTES) return `Ukuran foto maksimal ${AVATAR_MAX_BYTES / 1024 / 1024} MB.`;
  return null;
}

/** Spasi, tanda hubung, titik, dan kurung diabaikan agar "0812-3456 7890" diterima. */
export const normalizePhone = (value: string): string => value.replace(/[\s\-().]/g, '');

/**
 * Nomor telepon Indonesia: diawali 08 atau +628, total 10–15 digit (tanpa "+"). Kosong = tidak diisi.
 * [ASUMSI] Aturan format dari revisi desain pembimbing; SRS/SDD belum mengatur kolom telepon.
 */
export function isValidIndonesianPhone(value: string): boolean {
  const phone = normalizePhone(value);
  if (!/^(08|\+628)\d+$/.test(phone)) return false;
  const digits = phone.replace('+', '').length;
  return digits >= 10 && digits <= 15;
}

export const profileSchema = z.object({
  name: nameSchema,
  phone: z
    .string()
    .trim()
    .refine((value) => value === '' || isValidIndonesianPhone(value), 'Nomor telepon tidak valid. Gunakan format 08xx atau +628xx, 10–15 digit.'),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

/** Nilai form → body PATCH /profile: telepon kosong dikirim null, selain itu tanpa spasi/tanda hubung. */
export const toProfileInput = (values: ProfileFormValues): { name: string; phone: string | null } => ({
  name: values.name.trim(),
  phone: values.phone.trim() === '' ? null : normalizePhone(values.phone),
});
