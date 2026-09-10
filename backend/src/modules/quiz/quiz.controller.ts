import { Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards, Body } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { QuizService } from './quiz.service';

type AuthenticatedRequest = Request & { user: { id: string } };

@Controller('quiz')
@UseGuards(JwtAuthGuard)
export class QuizController {
	constructor(private readonly quizService: QuizService) {}

	@Get('tasks')
	listTasks(@Req() request: AuthenticatedRequest) {
		return this.quizService.listTasks(request.user.id);
	}

	@Post('tasks/:taskId/attempts')
	submitAttempt(
		@Req() request: AuthenticatedRequest,
		@Param('taskId', ParseUUIDPipe) taskId: string,
		@Body() input: SubmitQuizDto,
	) {
		return this.quizService.submitAttempt(request.user.id, taskId, input);
	}
}
