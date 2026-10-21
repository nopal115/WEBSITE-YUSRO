import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StatisticsService } from './statistics.service';

type AuthenticatedRequest = Request & { user: { id: string } };

@Controller('statistics')
@UseGuards(JwtAuthGuard)
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get()
  getStatistics(@Req() request: AuthenticatedRequest) {
    return this.statisticsService.getStudentStatistics(request.user.id);
  }

  @Get('chart')
  getChart(@Req() request: AuthenticatedRequest) {
    return this.statisticsService.getChartData(request.user.id);
  }

  @Get('history')
  getHistory(@Req() request: AuthenticatedRequest) {
    return this.statisticsService.getStudentHistory(request.user.id);
  }
}
