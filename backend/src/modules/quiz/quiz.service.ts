import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { AccountStatus, ContentStatus, TaskType } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { StorageService } from '../../shared/storage/storage.service';
import { feedbackCategoryFor } from '../evaluation/domain/evaluation.rules';
import { ProgressService } from '../progress/progress.service';
import { calculateQuizScore } from './domain/quiz.rules';
import { SubmitQuizDto } from './dto/submit-quiz.dto';

@Injectable()
export class QuizService {
	constructor(
		private readonly prisma: PrismaService,
		@Optional() private readonly progressService?: ProgressService,
		@Optional() private readonly storage?: StorageService,
	) {}

	private getProgressService() {
		return this.progressService ?? new ProgressService(this.prisma);
	}

	private getStorageService() {
		return this.storage ?? new StorageService();
	}

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

	async getTask(userId: string, taskId: string) {
		await this.assertActiveUser(userId);
		const task = await this.prisma.task.findFirst({
			where: { id: taskId, type: TaskType.QUIZ, status: ContentStatus.ACTIVE },
			include: { questions: { orderBy: { order: 'asc' }, include: { options: { orderBy: { id: 'asc' } } } } },
		});
		if (!task) throw new NotFoundException('Dengar-Pilih task not found');

		const [attemptCount, bestAttempt] = await Promise.all([
			this.prisma.attempt.count({ where: { userId, taskId, taskType: TaskType.QUIZ } }),
			this.prisma.attempt.findFirst({
				where: { userId, taskId, taskType: TaskType.QUIZ },
				orderBy: { score: 'desc' },
				select: { score: true },
			}),
		]);

		const questions = await Promise.all(
			task.questions.map(async (question, questionIndex) => {
				const questionAudioUrl = question.audioId
					? await this.prisma.audioAsset
						.findUnique({ where: { id: question.audioId }, select: { objectKey: true } })
						.then((audio) => (audio ? this.getStorageService().getSignedGetUrl(audio.objectKey) : ''))
					: '';
				// Acak pilihan jawaban agar sesi latihan terasa segar dan dinamis
				const shuffledOptions = [...question.options].sort(() => Math.random() - 0.5);
				return {
					id: question.id,
					orderIndex: question.order,
					prompt: question.prompt,
					audioUrl: questionAudioUrl,
					options: shuffledOptions.map((option, optionIndex) => {
						const parts = option.text.split('|').map((s) => s.trim());
						let arabicLabel = String.fromCharCode(65 + optionIndex);
						let label = option.text;
						if (parts.length >= 2) {
							arabicLabel = parts[0];
							label = parts[1];
						} else if (/[\u0600-\u06FF]/.test(option.text)) {
							arabicLabel = option.text;
							label = '';
						}
						return {
							id: option.id,
							label,
							arabicLabel,
							orderIndex: optionIndex,
						};
					}),
				};
			}),
		);

		return {
			id: task.id,
			title: task.title,
			instruction: 'Dengarkan audio berikut, lalu pilih jawaban yang benar.',
			questionCount: questions.length,
			attemptCount,
			bestScore: bestAttempt && bestAttempt.score !== null ? Number(bestAttempt.score) : null,
			questions,
		};
	}

	async submitAttempt(userId: string, taskId: string, input: SubmitQuizDto) {
		await this.assertActiveUser(userId);
		const task = await this.prisma.task.findFirst({
			where: { id: taskId, type: TaskType.QUIZ, status: ContentStatus.ACTIVE },
			include: { questions: { include: { options: true }, orderBy: { order: 'asc' } } },
		});
		if (!task) throw new NotFoundException('Dengar-Pilih task not found');
		if (input.answers.length !== task.questions.length) {
			throw new BadRequestException('All quiz questions must be answered');
		}

		const questionMap = new Map(task.questions.map((question) => [question.id, question]));
		const submittedQuestionIds = new Set<string>();
		let correctAnswers = 0;
		const results = [] as Array<{ questionId: string; isCorrect: boolean; selectedOptionId: string; correctOptionId: string }>;
		for (const answer of input.answers) {
			const question = questionMap.get(answer.questionId);
			if (!question || submittedQuestionIds.has(answer.questionId)) {
				throw new BadRequestException('Invalid or duplicate question answer');
			}
			const option = question.options.find((item) => item.id === answer.optionId);
			if (!option) throw new BadRequestException('Answer option does not belong to question');
			const correctOptionId = question.options.find((item) => item.isCorrect)?.id;
			if (!correctOptionId) throw new BadRequestException('Question is missing a valid correct answer');
			const isCorrect = option.id === correctOptionId;
			if (isCorrect) correctAnswers += 1;
			results.push({ questionId: question.id, isCorrect, selectedOptionId: option.id, correctOptionId });
			submittedQuestionIds.add(answer.questionId);
		}
		if (submittedQuestionIds.size !== task.questions.length) {
			throw new BadRequestException('Each question must be answered exactly once');
		}

		const score = calculateQuizScore(correctAnswers, task.questions.length);
		const attempt = await this.prisma.$transaction(async (transaction) => {
			const previous = await transaction.attempt.aggregate({
				where: { userId, taskId, taskType: TaskType.QUIZ },
				_max: { attemptNo: true },
			});
			const now = new Date();
			const createdAttempt = await transaction.attempt.create({
				data: {
					userId,
					taskId,
					taskType: TaskType.QUIZ,
					attemptNo: (previous._max.attemptNo ?? 0) + 1,
					score,
					feedbackCategory: feedbackCategoryFor(score),
					correctCount: correctAnswers,
					questionCount: task.questions.length,
					evaluatedAt: now,
					submittedAt: now,
					answers: { create: input.answers },
				},
			});
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

		const progress = await this.getProgressService().getProgress(userId);
		return {
			attemptId: attempt.id,
			attemptNo: attempt.attemptNo,
			score,
			correctCount: correctAnswers,
			questionCount: task.questions.length,
			feedbackCategory: feedbackCategoryFor(score),
			results,
			progress: {
				learningProgressPct: progress.learningProgressPct,
				tasksCompleted: progress.tasks.completed,
			},
		};
	}

	async getAttempt(userId: string, attemptId: string) {
		const attempt = await this.prisma.attempt.findFirst({
			where: { id: attemptId, userId },
			include: {
				task: {
					include: { questions: { orderBy: { order: 'asc' }, include: { options: { orderBy: { id: 'asc' }, select: { id: true, text: true, isCorrect: true } } } } },
				},
				answers: { include: { option: true, question: { include: { options: { orderBy: { id: 'asc' }, select: { id: true, text: true, isCorrect: true } } } } } },
			},
		});
		if (!attempt) throw new NotFoundException('Attempt not found');

		const results = attempt.answers.map((answer) => {
			const correctOptionId = answer.question.options.find((option) => option.isCorrect)?.id ?? answer.optionId;
			return {
				questionId: answer.questionId,
				isCorrect: answer.optionId === correctOptionId,
				selectedOptionId: answer.optionId,
				correctOptionId,
			};
		});

		return {
			attemptId: attempt.id,
			attemptNo: attempt.attemptNo,
			score: Number(attempt.score ?? 0),
			correctCount: attempt.correctCount ?? 0,
			questionCount: attempt.questionCount ?? attempt.answers.length,
			feedbackCategory: attempt.feedbackCategory ?? feedbackCategoryFor(Number(attempt.score ?? 0)),
			results,
			taskId: attempt.taskId,
			submittedAt: attempt.submittedAt.toISOString(),
			questions: attempt.task.questions.map((question) => ({
				id: question.id,
				orderIndex: question.order,
				prompt: question.prompt,
				options: question.options.map((option, optionIndex) => ({
					id: option.id,
					label: option.text,
					arabicLabel: String.fromCharCode(65 + optionIndex),
					orderIndex: optionIndex,
				})),
			})),
		};
	}

	private async assertActiveUser(userId: string): Promise<void> {
		const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
		if (!user) throw new NotFoundException('User not found');
		if (user.status !== AccountStatus.ACTIVE) throw new ForbiddenException('Account is inactive');
	}
}
