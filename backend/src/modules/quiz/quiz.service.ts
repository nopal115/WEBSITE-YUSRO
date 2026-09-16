import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, ContentStatus, TaskType } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { calculateQuizScore } from './domain/quiz.rules';
import { SubmitQuizDto } from './dto/submit-quiz.dto';

@Injectable()
export class QuizService {
	constructor(private readonly prisma: PrismaService) {}

	async listTasks(userId: string) {
		await this.assertActiveUser(userId);
		return this.prisma.task.findMany({
			where: { type: TaskType.QUIZ, status: ContentStatus.ACTIVE },
			orderBy: [{ stage: { order: 'asc' } }, { order: 'asc' }],
			select: {
				id: true,
				title: true,
				order: true,
				stageId: true,
				materialId: true,
				questions: {
					orderBy: { order: 'asc' },
					select: {
						id: true,
						prompt: true,
						order: true,
						audioId: true,
						options: { select: { id: true, text: true }, orderBy: { id: 'asc' } },
					},
				},
			},
		});
	}

	async submitAttempt(userId: string, taskId: string, input: SubmitQuizDto) {
		await this.assertActiveUser(userId);
		const task = await this.prisma.task.findFirst({
			where: { id: taskId, type: TaskType.QUIZ, status: ContentStatus.ACTIVE },
			include: { questions: { include: { options: true } } },
		});
		if (!task) throw new NotFoundException('Dengar-Pilih task not found');
		if (input.answers.length !== task.questions.length) {
			throw new BadRequestException('All quiz questions must be answered');
		}

		const questionMap = new Map(task.questions.map((question) => [question.id, question]));
		const submittedQuestionIds = new Set<string>();
		let correctAnswers = 0;
		for (const answer of input.answers) {
			const question = questionMap.get(answer.questionId);
			if (!question || submittedQuestionIds.has(answer.questionId)) {
				throw new BadRequestException('Invalid or duplicate question answer');
			}
			const option = question.options.find((item) => item.id === answer.optionId);
			if (!option) throw new BadRequestException('Answer option does not belong to question');
			if (option.isCorrect) correctAnswers += 1;
			submittedQuestionIds.add(answer.questionId);
		}
		if (submittedQuestionIds.size !== task.questions.length) {
			throw new BadRequestException('Each question must be answered exactly once');
		}

		const score = calculateQuizScore(correctAnswers, task.questions.length);
		const attempt = await this.prisma.$transaction(async (transaction) => {
			const createdAttempt = await transaction.quizAttempt.create({
				data: {
					userId,
					taskId,
					score,
					answers: { create: input.answers },
				},
			});
			const now = new Date();
			const progress = await transaction.taskProgress.findUnique({ where: { userId_taskId: { userId, taskId } }, select: { bestScore: true } });
			if (progress) {
				await transaction.taskProgress.update({
					where: { userId_taskId: { userId, taskId } },
					data: { completedAt: now, lastAttemptAt: now, attemptCount: { increment: 1 }, bestScore: Math.max(Number(progress.bestScore ?? 0), score) },
				});
			} else {
				await transaction.taskProgress.create({ data: { userId, taskId, completedAt: now, firstAttemptAt: now, lastAttemptAt: now, attemptCount: 1, bestScore: score } });
			}
			return createdAttempt;
		});

		return {
			attemptId: attempt.id,
			score,
			correctAnswers,
			totalQuestions: task.questions.length,
			completedAt: attempt.completedAt,
		};
	}

	private async assertActiveUser(userId: string): Promise<void> {
		const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
		if (!user) throw new NotFoundException('User not found');
		if (user.status !== AccountStatus.ACTIVE) throw new ForbiddenException('Account is inactive');
	}
}
