import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { ApiError } from '../../lib/api/ApiError';
import { authApi } from './api';
import { registerSchema, type RegisterFormValues } from './authSchemas';
import { AuthCardShell } from './AuthCardShell';

// Figma 02 / SDD 7.7.1 (UI-SAN-01).
export function RegisterPage(): JSX.Element {
  const navigate = useNavigate();
  const [emailTaken, setEmailTaken] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', passwordConfirmation: '' },
  });

  const mutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: ({ message }) => {
      // Registrasi tidak menerbitkan token (SDD 5.6); pengguna masuk sendiri di halaman login.
      navigate('/login', { state: { notice: message ?? 'Akun berhasil dibuat. Silakan masuk.' } });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'AUTH_EMAIL_TAKEN') return setEmailTaken(error.message);
      if (error instanceof ApiError && error.code === 'AUTH_WEAK_PASSWORD') return setError('password', { message: error.message });
      setServerError(error instanceof ApiError ? error.message : 'Terjadi kesalahan. Coba lagi.');
    },
  });

  const onSubmit = handleSubmit((values) => {
    setEmailTaken(null);
    setServerError(null);
    mutation.mutate(values);
  });

  // SDD 7.7.1: pesan email terpakai disertai tautan menuju halaman login.
  const emailError = emailTaken ? (
    <>
      {emailTaken}{' '}
      <Link to="/login" className="font-semibold underline">
        Masuk
      </Link>
    </>
  ) : (
    errors.email?.message
  );

  return (
    <AuthCardShell variant="register">
      {/* [REKOMENDASI] SDD belum mengatur tipografi mobile: H1 di bawah 768 px, Display di atasnya. */}
      <h1 className="text-h1 text-text-primary md:text-display">Buat akun Santri</h1>
      <p className="text-body-l text-text-secondary">Gratis, dan langsung bisa mulai dari Tahapan 1</p>

      <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
        <TextField label="Nama lengkap" autoComplete="name" error={errors.name?.message} {...register('name')} />
        <TextField label="Email" type="email" autoComplete="email" inputMode="email" error={emailError} {...register('email')} />
        <TextField label="Password" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
        <TextField
          label="Konfirmasi password"
          type="password"
          autoComplete="new-password"
          error={errors.passwordConfirmation?.message}
          {...register('passwordConfirmation')}
        />

        {serverError && (
          <div className="rounded-md bg-feedback-salah-soft px-5 py-3 text-body-s text-feedback-salah" role="alert">
            {serverError}
          </div>
        )}

        <Button type="submit" className="w-full" isLoading={mutation.isPending} loadingText="MEMPROSES…">
          REGISTRASI
        </Button>
      </form>

      <div className="flex items-center justify-center gap-2 pt-2">
        <span className="text-body text-text-secondary">Sudah punya akun?</span>
        <Link to="/login" className="text-h3 text-brand-primary hover:underline">
          Masuk
        </Link>
      </div>
    </AuthCardShell>
  );
}
