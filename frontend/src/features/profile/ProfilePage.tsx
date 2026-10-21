import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useForm, type FieldValues, type Path, type UseFormSetError } from 'react-hook-form';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { TextField } from '../../components/ui/TextField';
import { ApiError } from '../../lib/api/ApiError';
import { AUTH_ME_QUERY_KEY } from '../../lib/hooks/useAuth';
import { reportFileName, saveBlob } from '../../lib/utils/download';
import { changePasswordSchema, type ChangePasswordFormValues } from '../auth/authSchemas';
import { ErrorState, ListSkeleton } from '../learning/QueryStates';
import { reportApi } from '../report/api';
import { profileApi } from './api';
import { PROFILE_KEY, useProfile } from './hooks';
import type { Profile } from './types';
import { AVATAR_ACCEPTED_TYPES, AVATAR_MAX_BYTES, profileSchema, toProfileInput, validateAvatarFile, type ProfileFormValues } from './validation';

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

function ProfileForm({ profile }: { profile: Profile }): JSX.Element {
  const queryClient = useQueryClient();
  const [done, setDone] = useState(false);
  const { register, handleSubmit, setError, reset, formState: { errors } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: profile.name, phone: profile.phone ?? '' },
  });
  const mutation = useMutation({
    // PROPOSED API CONTRACT - sinkronkan dengan backend: PATCH /profile mengirim { name, phone }.
    mutationFn: (values: ProfileFormValues) => profileApi.update(toProfileInput(values)),
    onSuccess: (updated) => {
      queryClient.setQueryData(PROFILE_KEY, updated);
      reset({ name: updated.name, phone: updated.phone ?? '' });
      // Nama di header dan sapaan Dashboard ikut diperbarui.
      void queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setDone(true);
    },
    onError: (error) => applyFieldErrors(error, setError, ['name', 'phone']),
  });
  const onSubmit = handleSubmit((values) => {
    setDone(false);
    mutation.mutate(values);
  });
  const serverError = mutation.isError && !(mutation.error instanceof ApiError && Array.isArray(mutation.error.details)) ? errorText(mutation.error) : null;

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      <TextField label="Nama" autoComplete="name" error={errors.name?.message} {...register('name')} />
      <div>
        <TextField label="Nomor telepon (opsional)" type="tel" inputMode="tel" autoComplete="tel" placeholder="08xx atau +628xx" error={errors.phone?.message} {...register('phone')} />
        {!errors.phone && <p className="mt-2 text-body-s text-text-secondary">Format 08xx atau +628xx, 10–15 digit.</p>}
      </div>
      {done && <StatusMessage>Data berhasil disimpan.</StatusMessage>}
      {serverError && <AlertMessage>{serverError}</AlertMessage>}
      <Button type="submit" className="self-start" isLoading={mutation.isPending} loadingText="MENYIMPAN…">
        SIMPAN PERUBAHAN
      </Button>
    </form>
  );
}

/** Foto profil: pilih → pratinjau → simpan, atau hapus. Format dan ukuran diperiksa di client (validation.ts). */
function AvatarSection({ profile }: { profile: Profile }): JSX.Element {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // URL pratinjau dilepas saat diganti, dibatalkan, atau komponen dilepas.
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview.url) : undefined), [preview]);

  const focusActions = () => actionsRef.current?.querySelector('button')?.focus();
  const setAvatar = (avatarUrl: string | null) => queryClient.setQueryData<Profile>(PROFILE_KEY, (current) => (current ? { ...current, avatarUrl } : current));
  const upload = useMutation({
    mutationFn: (file: File) => profileApi.uploadAvatar(file),
    onSuccess: ({ avatarUrl }) => {
      setAvatar(avatarUrl);
      setPreview(null);
      setMessage({ tone: 'success', text: 'Foto profil berhasil disimpan.' });
      requestAnimationFrame(focusActions);
    },
    onError: (error) => setMessage({ tone: 'error', text: errorText(error) }),
  });
  const remove = useMutation({
    mutationFn: () => profileApi.deleteAvatar(),
    onSuccess: () => {
      setAvatar(null);
      setConfirmDelete(false);
      setMessage({ tone: 'success', text: 'Foto profil dihapus.' });
    },
  });
  const { reset: resetRemove } = remove;
  const closeDelete = useCallback(() => {
    setConfirmDelete(false);
    resetRemove();
    requestAnimationFrame(() => actionsRef.current?.querySelector('button')?.focus());
  }, [resetRemove]);

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const invalid = validateAvatarFile(file);
    if (invalid) {
      setMessage({ tone: 'error', text: invalid });
      return;
    }
    setMessage(null);
    setPreview({ file, url: URL.createObjectURL(file) });
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <Avatar name={profile.name} src={preview?.url ?? profile.avatarUrl} size="lg" />
      <div className="flex min-w-0 flex-col gap-3">
        <p className="text-body-s text-text-secondary">
          {preview ? 'Pratinjau foto baru, belum disimpan.' : `Foto profil: JPG, PNG, atau WebP, maksimal ${AVATAR_MAX_BYTES / 1024 / 1024} MB.`}
        </p>
        <input ref={inputRef} type="file" accept={AVATAR_ACCEPTED_TYPES.join(',')} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onPick} />
        <div ref={actionsRef} className="flex flex-wrap gap-3">
          {preview ? (
            <>
              <Button isLoading={upload.isPending} loadingText="MENGUNGGAH…" onClick={() => upload.mutate(preview.file)}>
                SIMPAN FOTO
              </Button>
              <Button variant="outline" disabled={upload.isPending} onClick={() => setPreview(null)}>
                BATAL
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => inputRef.current?.click()}>
                {profile.avatarUrl ? 'GANTI FOTO' : 'UNGGAH FOTO'}
              </Button>
              {profile.avatarUrl && (
                <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
                  HAPUS FOTO
                </Button>
              )}
            </>
          )}
        </div>
        {message && (message.tone === 'success' ? <StatusMessage>{message.text}</StatusMessage> : <AlertMessage>{message.text}</AlertMessage>)}
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title="Hapus foto profil?"
          message="Foto akan dihapus dan diganti inisial nama Anda."
          confirmLabel="HAPUS"
          pending={remove.isPending}
          error={remove.isError ? errorText(remove.error) : null}
          onConfirm={() => remove.mutate()}
          onClose={closeDelete}
        />
      )}
    </div>
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
    onSuccess: ({ blob, filename }) => saveBlob(blob, reportFileName(filename, studentCode)),
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
  const { data, isPending, isError, error, refetch } = useProfile();

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
        <AvatarSection profile={data} />
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
        <ProfileForm profile={data} />
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
