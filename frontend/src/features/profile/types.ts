import type { AccountStatus } from '../auth/types';

// SDD 5.7.
export interface Profile {
  studentCode: string;
  name: string;
  email: string;
  status: AccountStatus;
  joinedAt: string;
}

/** PATCH /profile hanya menerima name; field lain ditolak 422. */
export interface UpdateProfileInput {
  name: string;
}

/** [ASUMSI] Isi body PATCH /profile/password tidak dirinci SDD. */
export interface ChangePasswordInput {
  currentPassword: string;
  password: string;
  passwordConfirmation: string;
}
