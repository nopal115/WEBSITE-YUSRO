import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Pill } from '../../components/ui/Pill';
import { TextField } from '../../components/ui/TextField';
import { ApiError } from '../../lib/api/ApiError';
import { authApi } from './api';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from './authSchemas';
import { AuthCardShell } from './AuthCardShell';

// Figma 03 / SDD 7.7.3 (UI-SAN-03): langkah 1 (isi email) dan langkah 2 (pemberitahuan).
// SDD 7.12 memetakan UI-SAN-03 ke Stepper; untuk sekarang memakai Pill sebagai penanda langkah.
export function ForgotPasswordPage(): JSX.Element {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });

  const mutation = useMutation({ mutationFn: authApi.forgotPassword });
  const onSubmit = handleSubmit((values) => mutation.mutate(values));
  const serverError = mutation.isError ? (mutation.error instanceof ApiError ? mutation.error.message : 'Terjadi kesalahan. Coba lagi.') : null;

  if (mutation.isSuccess) {
    // Pesan tidak mengonfirmasi keberadaan email (SDD 7.7.3). Tanpa tombol kirim ulang
    // karena dibatasi 3 permintaan per jam per email (SDD 6.8).
    return (
      <AuthCardShell variant="compact">
        <div>
          <Pill status="terbuka">Langkah 2</Pill>
        </div>
        <h1 className="text-h1 text-text-primary">Lupa password</h1>
        <p className="text-body text-text-secondary" role="status">
          {mutation.data.message ?? 'Jika email terdaftar, tautan reset telah dikirim.'}
        </p>
        <Link to="/login" className="text-h3 text-brand-primary hover:underline">
          Kembali ke halaman masuk
        </Link>
      </AuthCardShell>
    );
  }

  return (
    <AuthCardShell variant="compact">
      <div>
        <Pill status="terbuka">Langkah 1</Pill>
      </div>
      <h1 className="text-h1 text-text-primary">Lupa password</h1>
      <p className="text-body text-text-secondary">Masukkan email akunmu. Kami kirimkan tautan untuk menetapkan password baru.</p>

      <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
        <TextField label="Email" type="email" autoComplete="email" inputMode="email" error={errors.email?.message} {...register('email')} />

        {serverError && (
          <div className="rounded-md bg-feedback-salah-soft px-5 py-3 text-body-s text-feedback-salah" role="alert">
            {serverError}
          </div>
        )}

        <Button type="submit" className="w-full" isLoading={mutation.isPending} loadingText="MENGIRIM…">
          KIRIM TAUTAN
        </Button>
      </form>
    </AuthCardShell>
  );
}
