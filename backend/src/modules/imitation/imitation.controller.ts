import { Controller, Get, Param, ParseUUIDPipe, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { ImitationService } from './imitation.service';

@Controller('imitation')
@UseGuards(JwtAuthGuard)
export class ImitationController {
	constructor(private readonly imitationService: ImitationService) {}

	@Get('tasks/:taskId')
	getTask(
		@Req() request: Request & { user: { id: string } },
		@Param('taskId', ParseUUIDPipe) taskId: string,
	) {
		return this.imitationService.getTask(request.user.id, taskId);
	}

	@Post('tasks/:taskId/submissions')
	@UseGuards(RolesGuard)
	@Roles(UserRole.SANTRI)
	@UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 10 * 1024 * 1024 } }))
	submitRecording(
		@Req() request: Request & { user: { id: string } },
		@Param('taskId', ParseUUIDPipe) taskId: string,
		@UploadedFile() file: Express.Multer.File,
	) {
		return this.imitationService.submitRecording(request.user.id, taskId, file);
	}

	@Get('submissions/:submissionId')
	getSubmission(
		@Req() request: Request & { user: { id: string } },
		@Param('submissionId', ParseUUIDPipe) submissionId: string,
	) {
		return this.imitationService.getSubmission(request.user.id, submissionId);
	}

	@Get('tasks/:taskId/submissions')
	listSubmissions(
		@Req() request: Request & { user: { id: string } },
		@Param('taskId', ParseUUIDPipe) taskId: string,
	) {
		return this.imitationService.listSubmissions(request.user.id, taskId);
	}
}
