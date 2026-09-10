import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProgressService } from './progress.service';

@Controller('progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
	constructor(private readonly progressService: ProgressService) {}

	@Get()
	getProgress(@Req() request: Request & { user: { id: string } }) {
		return this.progressService.getProgress(request.user.id);
	}
}
