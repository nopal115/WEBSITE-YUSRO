import { describe, expect, it } from 'vitest';
import { AVATAR_MAX_BYTES, isValidIndonesianPhone, profileSchema, toProfileInput, validateAvatarFile } from '../validation';

describe('isValidIndonesianPhone', () => {
  it('menerima 08xx dan +628xx dengan 10–15 digit, termasuk spasi dan tanda hubung', () => {
    expect(isValidIndonesianPhone('0812345678')).toBe(true);
    expect(isValidIndonesianPhone('081234567890123')).toBe(true);
    expect(isValidIndonesianPhone('+6281234567890')).toBe(true);
    expect(isValidIndonesianPhone('0812-3456 7890')).toBe(true);
  });

  it('menolak awalan lain, huruf, dan panjang di luar 10–15 digit', () => {
    expect(isValidIndonesianPhone('6281234567890')).toBe(false);
    expect(isValidIndonesianPhone('0712345678')).toBe(false);
    expect(isValidIndonesianPhone('08123abc90')).toBe(false);
    expect(isValidIndonesianPhone('081234567')).toBe(false);
    expect(isValidIndonesianPhone('0812345678901234')).toBe(false);
    expect(isValidIndonesianPhone('+62812345678901234')).toBe(false);
  });
});

describe('profileSchema dan toProfileInput', () => {
  it('telepon boleh kosong dan dikirim null', () => {
    const parsed = profileSchema.parse({ name: 'Siti Aisyah', phone: '  ' });
    expect(toProfileInput(parsed)).toEqual({ name: 'Siti Aisyah', phone: null });
  });

  it('telepon diisi dikirim tanpa spasi dan tanda hubung', () => {
    const parsed = profileSchema.parse({ name: ' Siti Aisyah ', phone: '0812-3456 7890' });
    expect(toProfileInput(parsed)).toEqual({ name: 'Siti Aisyah', phone: '081234567890' });
  });

  it('nama tetap wajib dan telepon tidak valid ditolak', () => {
    const result = profileSchema.safeParse({ name: '', phone: '123' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((issue) => issue.path[0])).toEqual(expect.arrayContaining(['name', 'phone']));
  });
});

describe('validateAvatarFile', () => {
  it('menerima JPG, PNG, dan WebP sampai batas ukuran', () => {
    expect(validateAvatarFile({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(validateAvatarFile({ type: 'image/png', size: AVATAR_MAX_BYTES })).toBeNull();
    expect(validateAvatarFile({ type: 'image/webp', size: 1 })).toBeNull();
  });

  it('menolak format lain dan berkas yang terlalu besar', () => {
    expect(validateAvatarFile({ type: 'image/gif', size: 10 })).toBe('Foto harus berformat JPG, PNG, atau WebP.');
    expect(validateAvatarFile({ type: 'image/jpeg', size: AVATAR_MAX_BYTES + 1 })).toBe('Ukuran foto maksimal 2 MB.');
  });
});
