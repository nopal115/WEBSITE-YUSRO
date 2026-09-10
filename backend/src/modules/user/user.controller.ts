import { Controller, Get, NotFoundException, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getCurrentUser(@Req() request: Request & { user: { id: string } }) {
    const user = await this.userService.findPublicById(request.user.id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
