import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';
import { Public } from '../../shared/decorators/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((acc, pair) => {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      try {
        acc[key] = decodeURIComponent(val);
      } catch {
        acc[key] = val;
      }
    }
    return acc;
  }, {} as Record<string, string>);
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  async register(@Body() input: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.register(input);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('login')
  @Public()
  async login(@Body() input: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(input);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('refresh')
  @Public()
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const headerCookies = parseCookieHeader(request.headers.cookie);
    const refreshToken = (request as any).cookies?.refresh_token ?? headerCookies.refresh_token ?? null;
    const result = await this.authService.refresh(refreshToken);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() request: Request & { user?: { id: string } }, @Res({ passthrough: true }) response: Response) {
    const userId = request.user?.id;
    if (userId) {
      await this.authService.logout(userId);
    }
    response.clearCookie('refresh_token', { httpOnly: true, sameSite: 'lax', path: '/' });
    return { success: true, message: 'Logout berhasil.' };
  }

  @Post('forgot-password')
  @Public()
  async forgotPassword(@Body() input: ForgotPasswordDto) {
    return this.authService.forgotPassword(input);
  }

  @Post('reset-password')
  @Public()
  async resetPassword(@Body() input: ResetPasswordDto) {
    return this.authService.resetPassword(input);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() request: Request & { user: { id: string } }) {
    return this.authService.getMe(request.user.id);
  }

  private setRefreshCookie(response: Response, refreshToken: string) {
    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
