import { z } from 'zod';

// Tanpa minimal 8 karakter: itu aturan registrasi, bukan login.
export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email wajib diisi.').email('Format email tidak valid.'),
  password: z.string().min(1, 'Password wajib diisi.'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
