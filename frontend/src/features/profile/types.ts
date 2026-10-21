import type { AccountStatus } from '../auth/types';

// SDD 5.7. PROPOSED API CONTRACT - sinkronkan dengan backend: id, phone, dan avatarUrl belum ada di backend main
// (GET /profile mengirim { id, studentId, email, name, role, status, createdAt, updatedAt }).
export interface Profile {
  id: string;
  studentCode: string;
  name: string;
  email: string;
  /** Opsional; format Indonesia (08xx/+628xx), null bila belum diisi. */
  phone: string | null;
  /** URL foto profil; null bila belum ada (tampil inisial nama). */
  avatarUrl: string | null;
  status: AccountStatus;
  joinedAt: string;
}

/** PROPOSED API CONTRACT - sinkronkan dengan backend: PATCH /profile menerima name dan phone; field lain ditolak 422. */
export interface UpdateProfileInput {
  name: string;
  phone: string | null;
}

/** PROPOSED API CONTRACT - sinkronkan dengan backend: respons POST /profile/avatar. */
export interface AvatarUploadResult {
  avatarUrl: string;
}

/** [ASUMSI] Isi body PATCH /profile/password tidak dirinci SDD. */
export interface ChangePasswordInput {
  currentPassword: string;
  password: string;
  passwordConfirmation: string;
}
