import { describe, expect, it } from 'vitest';
import { registerSchema, resetPasswordSchema } from '../authSchemas';

const valid = { name: 'Ahmad Fauzi', email: 'ahmad@example.com', password: 'santri2026', passwordConfirmation: 'santri2026' };
const fieldErrors = (input: unknown) => {
  const result = registerSchema.safeParse(input);
  return result.success ? {} : result.error.flatten().fieldErrors;
};

describe('registerSchema (SDD 3.2.6)', () => {
  it('menerima data valid dan menormalkan email', () => {
    const result = registerSchema.parse({ ...valid, email: '  Ahmad@Example.COM ' });
    expect(result.email).toBe('ahmad@example.com');
  });

  it('nama 3–100 karakter: huruf termasuk non-ASCII, spasi, tanda hubung, apostrof', () => {
    expect(fieldErrors({ ...valid, name: "Siti Nur'aini Al-Fatih" }).name).toBeUndefined();
    expect(fieldErrors({ ...valid, name: 'Zoë Ñúñez' }).name).toBeUndefined();
    expect(fieldErrors({ ...valid, name: 'Ab' }).name).toBeDefined();
    expect(fieldErrors({ ...valid, name: 'a'.repeat(101) }).name).toBeDefined();
    expect(fieldErrors({ ...valid, name: 'Ahmad 2' }).name).toBeDefined();
    expect(fieldErrors({ ...valid, name: 'Ahmad_F' }).name).toBeDefined();
  });

  it('email wajib, valid, maksimal 190 karakter', () => {
    expect(fieldErrors({ ...valid, email: 'bukan-email' }).email).toBeDefined();
    expect(fieldErrors({ ...valid, email: `${'a'.repeat(185)}@b.co` }).email).toBeUndefined(); // tepat 190
    expect(fieldErrors({ ...valid, email: `${'a'.repeat(186)}@b.co` }).email).toBeDefined(); // 191
  });

  it('password minimal 8 karakter dengan huruf dan angka', () => {
    for (const password of ['abc123', 'abcdefgh', '12345678']) {
      expect(fieldErrors({ ...valid, password, passwordConfirmation: password }).password).toBeDefined();
    }
    expect(fieldErrors({ ...valid, password: 'abcdefg1', passwordConfirmation: 'abcdefg1' }).password).toBeUndefined();
  });

  it('konfirmasi harus identik dengan password', () => {
    expect(fieldErrors({ ...valid, passwordConfirmation: 'santri2027' }).passwordConfirmation).toBeDefined();
  });
});

describe('resetPasswordSchema', () => {
  it('memakai aturan password yang sama dengan registrasi', () => {
    expect(resetPasswordSchema.safeParse({ password: 'abcdefgh', passwordConfirmation: 'abcdefgh' }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: 'barubaru123', passwordConfirmation: 'barubaru123' }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ password: 'barubaru123', passwordConfirmation: 'beda12345' }).success).toBe(false);
  });
});
