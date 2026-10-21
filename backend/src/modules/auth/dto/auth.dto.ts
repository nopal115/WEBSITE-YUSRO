import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password minimal 8 karakter.' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Password minimal memuat satu huruf dan satu angka.',
  })
  password!: string;

  @IsString()
  @MinLength(1)
  passwordConfirmation!: string;

  @IsString()
  @MinLength(1, { message: 'Nama tidak boleh kosong.' })
  name!: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Format email tidak valid.' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password minimal 8 karakter.' })
  password!: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Format email tidak valid.' })
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(1, { message: 'Token reset wajib diisi.' })
  token!: string;

  @IsString()
  @MinLength(8, { message: 'Password minimal 8 karakter.' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Password minimal memuat satu huruf dan satu angka.',
  })
  password!: string;

  @IsString()
  @MinLength(1, { message: 'Konfirmasi password wajib diisi.' })
  passwordConfirmation!: string;
}
