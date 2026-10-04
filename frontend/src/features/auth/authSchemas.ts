import { z } from 'zod';

// Aturan validasi SDD 3.2.6.
const NAME_PATTERN = /^[\p{L}\s'-]+$/u;
const LETTER = /\p{L}/u;
const DIGIT = /\d/;

export const passwordSchema = z
  .string()
  .min(8, 'Password minimal 8 karakter.')
  .refine((value) => LETTER.test(value) && DIGIT.test(value), 'Password harus memuat huruf dan angka.');

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, 'Nama minimal 3 karakter.')
      .max(100, 'Nama maksimal 100 karakter.')
      .regex(NAME_PATTERN, 'Nama hanya boleh berisi huruf, spasi, tanda hubung, dan apostrof.'),
    // Di-trim dan diubah ke huruf kecil sebelum dikirim (SDD 3.2.6).
    email: z.string().trim().toLowerCase().min(1, 'Email wajib diisi.').max(190, 'Email maksimal 190 karakter.').email('Format email tidak valid.'),
    password: passwordSchema,
    passwordConfirmation: z.string().min(1, 'Konfirmasi password wajib diisi.'),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'Konfirmasi password tidak sama.',
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Email wajib diisi.').email('Format email tidak valid.'),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    passwordConfirmation: z.string().min(1, 'Konfirmasi password wajib diisi.'),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'Konfirmasi password tidak sama.',
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
