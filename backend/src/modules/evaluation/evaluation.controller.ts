import { Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { EvaluationService } from './evaluation.service';

@Controller()
@UseGuards(RolesGuard)
export class EvaluationController {
	constructor(private readonly evaluationService: EvaluationService) {}

	@Get('evaluation')
	getReadiness() {
		return this.evaluationService.getReadiness();
	}

	@Post('admin/submissions/:id/retry')
	@Roles(UserRole.ADMIN)
	retry(@Req() request: Request & { user: { id: string } }, @Param('id', ParseUUIDPipe) id: string) {
		return this.evaluationService.retryByAdmin(request.user.id, id);
	}

	@Get('admin/evaluation/queue')
	@Roles(UserRole.ADMIN)
	queue() {
		return this.evaluationService.getQueue();
	}
}
