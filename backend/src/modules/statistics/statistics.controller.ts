import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StatisticsService } from './statistics.service';

@Controller('statistics')
@UseGuards(JwtAuthGuard)
export class StatisticsController {
	constructor(private readonly statisticsService: StatisticsService) {}

	@Get()
	getStatistics(@Req() request: Request & { user: { id: string } }) {
		return this.statisticsService.getStudentStatistics(request.user.id);
	}

	@Get('history')
	getHistory(@Req() request: Request & { user: { id: string } }) {
		return this.statisticsService.getStudentHistory(request.user.id);
	}
}
