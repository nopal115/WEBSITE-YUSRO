import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, type FieldValues, type Path, type UseFormSetError } from 'react-hook-form';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TextField } from '../../components/ui/TextField';
import { ApiError } from '../../lib/api/ApiError';
import { AUTH_ME_QUERY_KEY } from '../../lib/hooks/useAuth';
import { changePasswordSchema, profileNameSchema, type ChangePasswordFormValues, type ProfileNameFormValues } from '../auth/authSchemas';
import { ErrorState, ListSkeleton } from '../learning/QueryStates';
import { reportApi } from '../report/api';
import { profileApi } from './api';
import type { Profile } from './types';

const PROFILE_KEY = ['profile'] as const;
const STATUS_LABEL = { ACTIVE: 'Aktif', INACTIVE: 'Nonaktif' } as const;

/** Galat per kolom dari server (errors[] SDD 5.5) dipasang ke kolom form; mengembalikan true bila ada. */
function applyFieldErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: Path<T>[]): boolean {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return false;
  let applied = false;
  for (const item of error.details as { field?: string; message?: string }[]) {
    const field = fields.find((name) => name === item.field);
    if (field && item.message) {
      setError(field, { message: item.message });
      applied = true;
    }
  }
  return applied;
}

const errorText = (error: unknown) => (error instanceof ApiError ? error.message : 'Terjadi kesalahan. Coba lagi.');

function StatusMessage({ children }: { children: string }): JSX.Element {
  return (
    <p className="rounded-md bg-feedback-benar-soft px-5 py-3 text-body-s text-feedback-benar" role="status">
      {children}
    </p>
  );
}

function AlertMessage({ children }: { children: string }): JSX.Element {
  return (
    <p className="rounded-md bg-feedback-salah-soft px-5 py-3 text-body-s text-feedback-salah" role="alert">
      {children}
    </p>
  );
}

function NameForm({ profile }: { profile: Profile }): JSX.Element {
  const queryClient = useQueryClient();
  const [done, setDone] = useState(false);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<ProfileNameFormValues>({
    resolver: zodResolver(profileNameSchema),
    defaultValues: { name: profile.name },
  });
  const mutation = useMutation({
    // PATCH /profile hanya mengirim { name } (SDD 5.7).
    mutationFn: (values: ProfileNameFormValues) => profileApi.update({ name: values.name }),
    onSuccess: (updated) => {
      queryClient.setQueryData(PROFILE_KEY, updated);
      // Nama di header dan sapaan Dashboard ikut diperbarui.
      void queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setDone(true);
    },
    onError: (error) => applyFieldErrors(error, setError, ['name']),
  });
  const onSubmit = handleSubmit((values) => {
    setDone(false);
    mutation.mutate(values);
  });
  const serverError = mutation.isError && !(mutation.error instanceof ApiError && Array.isArray(mutation.error.details)) ? errorText(mutation.error) : null;

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      <TextField label="Nama" autoComplete="name" error={errors.name?.message} {...register('name')} />
      {done && <StatusMessage>Data berhasil disimpan.</StatusMessage>}
      {serverError && <AlertMessage>{serverError}</AlertMessage>}
      <Button type="submit" className="self-start" isLoading={mutation.isPending} loadingText="MENYIMPAN…">
        SIMPAN NAMA
      </Button>
    </form>
  );
}

function PasswordForm(): JSX.Element {
  const [done, setDone] = useState(false);
  const { register, handleSubmit, setError, reset, formState: { errors } } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', password: '', passwordConfirmation: '' },
  });
  const mutation = useMutation({
    mutationFn: profileApi.changePassword,
    onSuccess: () => {
      reset();
      setDone(true);
    },
    onError: (error) => {
      if (applyFieldErrors(error, setError, ['currentPassword', 'password', 'passwordConfirmation'])) return;
      if (error instanceof ApiError && error.code === 'AUTH_WEAK_PASSWORD') setError('password', { message: error.message });
    },
  });
  const onSubmit = handleSubmit((values) => {
    setDone(false);
    mutation.mutate(values);
  });
  const handled = mutation.error instanceof ApiError && (Array.isArray(mutation.error.details) || mutation.error.code === 'AUTH_WEAK_PASSWORD');
  const serverError = mutation.isError && !handled ? errorText(mutation.error) : null;

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      <TextField label="Password lama" type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
      <TextField label="Password baru" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
      <TextField label="Konfirmasi password baru" type="password" autoComplete="new-password" error={errors.passwordConfirmation?.message} {...register('passwordConfirmation')} />
      {done && <StatusMessage>Password berhasil diubah.</StatusMessage>}
      {serverError && <AlertMessage>{serverError}</AlertMessage>}
      <Button type="submit" className="self-start" isLoading={mutation.isPending} loadingText="MENYIMPAN…">
        UBAH PASSWORD
      </Button>
    </form>
  );
}

function ReportSection({ studentCode }: { studentCode: string }): JSX.Element {
  const mutation = useMutation({
    mutationFn: () => reportApi.downloadPdf(),
    onSuccess: ({ blob, filename }) => {
      // Nama dari Content-Disposition; cadangan mengikuti pola SDD 5.13.
      const name = filename ?? `Laporan-${studentCode}-${new Date().toISOString().slice(0, 10)}.pdf`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
  });
  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-text-secondary">Unduh laporan hasil belajar Anda dalam format PDF.</p>
      {mutation.isError && <AlertMessage>{errorText(mutation.error)}</AlertMessage>}
      <Button variant="outline" className="self-start" isLoading={mutation.isPending} loadingText="MENYIAPKAN…" onClick={() => mutation.mutate()}>
        UNDUH PDF
      </Button>
    </div>
  );
}

// SDD 7.7.15 (UI-PROFILE-01/02). [REKOMENDASI] Tampilan disusun dari SDD dan UI kit; Figma 20 belum dicocokkan.
// Tombol logout belum ditambahkan (menunggu desain).
export function ProfilePage(): JSX.Element {
  const { data, isPending, isError, error, refetch } = useQuery({ queryKey: PROFILE_KEY, queryFn: ({ signal }) => profileApi.get(signal) });

  if (isPending) {
    return (
      <div className="mx-auto max-w-[760px]">
        <ListSkeleton rows={3} />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="mx-auto max-w-[760px]">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6">
      <Card className="flex flex-col gap-5">
        <h2 className="text-h3">Data diri</h2>
        {/* ID Santri, email, dan status sebagai teks biasa: tidak dapat diubah (SDD 7.7.15). */}
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-label text-text-muted">ID SANTRI</dt>
            <dd className="mt-1 text-body text-text-primary">{data.studentCode}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-label text-text-muted">EMAIL</dt>
            <dd className="mt-1 break-words text-body text-text-primary">{data.email}</dd>
          </div>
          <div>
            <dt className="text-label text-text-muted">STATUS</dt>
            <dd className="mt-1 text-body text-text-primary">{STATUS_LABEL[data.status]}</dd>
          </div>
        </dl>
        <NameForm profile={data} />
      </Card>

      <Card className="flex flex-col gap-5">
        <h2 className="text-h3">Ubah password</h2>
        <PasswordForm />
      </Card>

      <Card className="flex flex-col gap-5">
        <h2 className="text-h3">Laporan</h2>
        <ReportSection studentCode={data.studentCode} />
      </Card>
    </div>
  );
}
