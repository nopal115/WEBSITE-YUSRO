import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProgressService } from './progress.service';

type AuthenticatedRequest = Request & { user: { id: string } };

@Controller('progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get()
  getProgress(@Req() request: AuthenticatedRequest) {
    return this.progressService.getProgress(request.user.id);
  }

  @Get('history')
  getHistory(
    @Req() request: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.progressService.getHistory(request.user.id, Number(page) || 1, Number(limit) || 20);
  }
}
