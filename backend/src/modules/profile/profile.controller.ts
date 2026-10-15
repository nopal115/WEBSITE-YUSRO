import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Request } from 'express';
import { ProfileService } from './profile.service';

class UpdateProfileDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
}

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getProfile(@Req() request: Request & { user: { id: string } }) {
    return this.profileService.getProfile(request.user.id);
  }

  @Patch()
  updateProfile(
    @Req() request: Request & { user: { id: string } },
    @Body() input: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(request.user.id, input.name);
  }
}
