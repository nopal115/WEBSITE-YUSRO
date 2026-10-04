import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { useLogin } from '../../lib/hooks/useAuth';
import { getLoginErrorMessage } from './api';
import { loginSchema, type LoginFormValues } from './loginSchema';

// Figma "YSR/01 Login" (fileKey evo1Ng9bhjqhwmmcM5eULY, node 15:2728).
// Redirect setelah login berhasil ditangani AuthLayout.

function BrandLogo(): JSX.Element {
  return (
    <div
      className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-md bg-brand-accent font-arabic text-arabic-s text-brand-primary"
      aria-hidden="true"
      lang="ar"
      dir="rtl"
    >
      ي
    </div>
  );
}

export function LoginPage(): JSX.Element {
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit((values) => login.mutate(values));
  const serverError = login.isError ? getLoginErrorMessage(login.error) : null;

  return (
    <div className="flex min-h-screen bg-neutral-surface-alt text-text-primary">
      <aside className="hidden w-[560px] shrink-0 flex-col justify-between bg-brand-primary p-16 text-text-on-brand lg:flex">
        <div className="flex items-center gap-4">
          <BrandLogo />
          <span className="text-h1">Yusro</span>
        </div>
        <div className="flex flex-col gap-6">
          <p className="text-display">Belajar mengaji, satu langkah tiap hari.</p>
          <p className="text-body-l opacity-[0.78]">
            Dengar contohnya, tirukan bacaannya, dan langsung tahu apakah pelafalanmu sudah tepat.
          </p>
        </div>
        <p className="text-body-s opacity-[0.55]">Badan Riset dan Inovasi Nasional</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[440px]">
          {/* [REKOMENDASI] Tidak ada di Figma: pengganti panel kiri di bawah 1024px. */}
          <div className="mb-10 flex items-center gap-4 lg:hidden">
            <BrandLogo />
            <span className="text-h1 text-brand-primary">Yusro</span>
          </div>

          <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
            <h1 className="text-display text-text-primary">Masuk</h1>
            <p className="text-body-l text-text-secondary">Lanjutkan pembelajaranmu</p>

            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              inputMode="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-body text-brand-primary hover:underline">
                Lupa password?
              </Link>
            </div>

            {/* [REKOMENDASI] Tidak ada di Figma: kotak error dari server (SDD 7.7.2). */}
            {serverError && (
              <div className="rounded-md bg-feedback-salah-soft px-5 py-3 text-body-s text-feedback-salah" role="alert">
                {serverError}
              </div>
            )}

            <Button type="submit" className="w-full" isLoading={login.isPending} loadingText="MEMPROSES…">
              MASUK
            </Button>

            <div className="flex items-center justify-center gap-2 pt-2">
              <span className="text-body text-text-secondary">Belum punya akun?</span>
              <Link to="/register" className="text-h3 text-brand-primary hover:underline">
                Daftar
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
