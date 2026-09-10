import { Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LearningService } from './learning.service';

type AuthenticatedRequest = Request & { user: { id: string } };

@Controller('learning')
@UseGuards(JwtAuthGuard)
export class LearningController {
	constructor(private readonly learningService: LearningService) {}

	@Get('stages')
	getStages(@Req() request: AuthenticatedRequest) {
		return this.learningService.getStages(request.user.id);
	}

	@Post('materials/:materialId/complete')
	completeMaterial(
		@Req() request: AuthenticatedRequest,
		@Param('materialId', ParseUUIDPipe) materialId: string,
	) {
		return this.learningService.completeMaterial(request.user.id, materialId);
	}
}
