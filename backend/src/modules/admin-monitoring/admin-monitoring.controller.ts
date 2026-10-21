import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { EvaluationStatus, FeedbackCategory, TaskType, UserRole } from '@prisma/client';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { AdminMonitoringService } from './admin-monitoring.service';
import { GradeSubmissionDto } from './dto/grade-submission.dto';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = new Set(Object.values(EvaluationStatus));

@Controller('admin')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminMonitoringController {
	constructor(private readonly adminMonitoringService: AdminMonitoringService) {}

	@Get('submissions')
	listSubmissions(
		@Query('status') status?: string,
		@Query('taskId', new ParseUUIDPipe({ optional: true })) taskId?: string,
		@Query('studentId', new ParseUUIDPipe({ optional: true })) studentId?: string,
		@Query('from') from?: string,
		@Query('to') to?: string,
		@Query('page') page?: string,
		@Query('limit') limit?: string,
	) {
		if (status && !STATUSES.has(status as EvaluationStatus)) throw new BadRequestException('Invalid evaluation status');
		if (from && !this.isDate(from)) throw new BadRequestException('Invalid from date');
		if (to && !this.isDate(to)) throw new BadRequestException('Invalid to date');
		if (from && to && from > to) throw new BadRequestException('End date must not be earlier than start date');
		return this.adminMonitoringService.listSubmissions({
			status: status as EvaluationStatus | undefined,
			taskId,
			studentId,
			from,
			to,
			page: this.parsePositiveInteger(page, 1),
			limit: Math.min(this.parsePositiveInteger(limit, 20), 100),
		});
	}

	@Get('submissions/:submissionId')
	getSubmission(@Param('submissionId', ParseUUIDPipe) submissionId: string) {
		return this.adminMonitoringService.getSubmission(submissionId);
	}

	@Get('submissions/:submissionId/recording-url')
	getRecordingUrl(@Param('submissionId', ParseUUIDPipe) submissionId: string) {
		return this.adminMonitoringService.getRecordingUrl(submissionId);
	}

	@Post('submissions/:submissionId/grade')
	gradeSubmission(
		@Param('submissionId', ParseUUIDPipe) submissionId: string,
		@Body() body: GradeSubmissionDto,
	) {
		if (body.score === undefined || body.score === null || isNaN(Number(body.score))) {
			throw new BadRequestException('Nilai harus diisi dengan angka (0 - 100)');
		}
		return this.adminMonitoringService.gradeSubmission(submissionId, {
			score: Number(body.score),
			feedbackCategory: body.feedbackCategory,
			notes: body.notes,
		});
	}

	@Get('tasks')
	getTasks(@Query('type') type?: string) {
		if (type && !Object.values(TaskType).includes(type as TaskType)) throw new BadRequestException('Invalid task type');
		return this.adminMonitoringService.getTasks(type as TaskType | undefined);
	}

	private parsePositiveInteger(value: string | undefined, fallback: number): number {
		if (value === undefined) return fallback;
		const parsed = Number(value);
		if (!Number.isInteger(parsed) || parsed < 1) throw new BadRequestException('Pagination values must be positive integers');
		return parsed;
	}

	private isDate(value: string): boolean {
		if (!DATE_PATTERN.test(value)) return false;
		const date = new Date(`${value}T00:00:00.000Z`);
		return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
	}
}
