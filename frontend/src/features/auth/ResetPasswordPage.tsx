import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Pill } from '../../components/ui/Pill';
import { TextField } from '../../components/ui/TextField';
import { ApiError } from '../../lib/api/ApiError';
import { tokenStore } from '../../lib/auth/tokenStore';
import { authApi } from './api';
import { resetPasswordSchema, type ResetPasswordFormValues } from './authSchemas';
import { AuthCardShell } from './AuthCardShell';

const INVALID_LINK = 'Tautan reset tidak berlaku. Silakan minta tautan baru.';

// Figma 03 / SDD 7.7.3 (UI-SAN-03): langkah 3 (password baru).
// SDD 7.12 memetakan UI-SAN-03 ke Stepper; untuk sekarang memakai Pill sebagai penanda langkah.
export function ResetPasswordPage(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // [ASUMSI] Nama parameter ?token= tidak disebut SDD; harus disamakan dengan tautan dari backend.
  const token = useSearchParams()[0].get('token') ?? '';
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: '', passwordConfirmation: '' } });

  const mutation = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: ({ message }) => {
      // Sesi lama dibatalkan server setelah reset (SDD 3.2.6); sesi lokal ikut dihapus.
      tokenStore.clear();
      queryClient.clear();
      // [ASUMSI] Teks cadangan bila server tidak mengirim message.
      navigate('/login', { replace: true, state: { notice: message ?? 'Password berhasil diubah. Silakan masuk.' } });
    },
  });

  const onSubmit = handleSubmit((values) => mutation.mutate({ token, ...values }));
  const error = mutation.error;
  const linkInvalid = !token || (error instanceof ApiError && error.code === 'AUTH_RESET_INVALID');

  if (linkInvalid) {
    return (
      <AuthCardShell variant="compact">
        <h1 className="text-h1 text-text-primary">Password baru</h1>
        <p className="rounded-md bg-feedback-salah-soft px-5 py-3 text-body-s text-feedback-salah" role="alert">
          {error instanceof ApiError && error.code === 'AUTH_RESET_INVALID' ? error.message : INVALID_LINK}
        </p>
        <Link to="/forgot-password" className="text-h3 text-brand-primary hover:underline">
          Minta tautan baru
        </Link>
      </AuthCardShell>
    );
  }

  const passwordError = error instanceof ApiError && error.code === 'AUTH_WEAK_PASSWORD' ? error.message : errors.password?.message;
  const serverError = error && !(error instanceof ApiError && error.code === 'AUTH_WEAK_PASSWORD') ? (error instanceof ApiError ? error.message : 'Terjadi kesalahan. Coba lagi.') : null;

  return (
    <AuthCardShell variant="compact">
      <div>
        <Pill status="terbuka">Langkah 3</Pill>
      </div>
      <h1 className="text-h1 text-text-primary">Password baru</h1>
      <p className="text-body text-text-secondary">Tautan berlaku 60 menit dan hanya dapat dipakai satu kali.</p>

      <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
        <TextField label="Password baru" type="password" autoComplete="new-password" error={passwordError} {...register('password')} />
        <TextField label="Konfirmasi" type="password" autoComplete="new-password" error={errors.passwordConfirmation?.message} {...register('passwordConfirmation')} />

        {serverError && (
          <div className="rounded-md bg-feedback-salah-soft px-5 py-3 text-body-s text-feedback-salah" role="alert">
            {serverError}
          </div>
        )}

        <Button type="submit" className="w-full" isLoading={mutation.isPending} loadingText="MENYIMPAN…">
          SIMPAN
        </Button>
      </form>
    </AuthCardShell>
  );
}
