import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProfileService } from './profile.service';

class UpdateProfileDto {
  @IsString()
  @IsNotEmpty({ message: 'Nama tidak boleh kosong.' })
  @MinLength(2, { message: 'Nama minimal 2 karakter.' })
  @MaxLength(100, { message: 'Nama maksimal 100 karakter.' })
  name!: string;
}

class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Password lama wajib diisi.' })
  currentPassword!: string;

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

type AuthenticatedRequest = Request & { user: { id: string } };

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getProfile(@Req() request: AuthenticatedRequest) {
    return this.profileService.getProfile(request.user.id);
  }

  @Patch()
  updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() input: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(request.user.id, input.name);
  }

  @Patch('password')
  changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() input: ChangePasswordDto,
  ) {
    return this.profileService.changePassword(
      request.user.id,
      input.currentPassword,
      input.password,
      input.passwordConfirmation,
    );
  }
}
