// Kontrak SDD 5.6.
export type UserRole = 'SANTRI' | 'ADMIN';

export type AccountStatus = 'ACTIVE' | 'INACTIVE';

/** Ringkasan pengguna pada respons login (SDD 5.6). Admin tidak punya studentCode. */
export interface AuthUser {
  id: string;
  studentCode: string | null;
  name: string;
  role: UserRole;
  status: AccountStatus;
}

/** [ASUMSI] GET /auth/me = ringkasan login ditambah email (SDD tidak merinci isinya). */
export interface User extends AuthUser {
  email: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  /** Masa berlaku access token dalam detik. */
  expiresIn: number;
  user: AuthUser;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
  passwordConfirmation: string;
}
