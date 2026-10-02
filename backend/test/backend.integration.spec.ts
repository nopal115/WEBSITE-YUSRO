import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  AccountStatus,
  AudioStatus,
  AudioType,
  ContentStatus,
  EvaluationStatus,
  TaskType,
  UserRole,
} from '@prisma/client';
import { AuthService } from '../src/modules/auth/auth.service';
import { ImitationService } from '../src/modules/imitation/imitation.service';
import { LearningService } from '../src/modules/learning/learning.service';
import { ProgressService } from '../src/modules/progress/progress.service';
import { QuizService } from '../src/modules/quiz/quiz.service';
import { StatisticsService } from '../src/modules/statistics/statistics.service';
import { JwtStrategy } from '../src/modules/auth/jwt.strategy';
import { RolesGuard } from '../src/shared/guards/roles.guard';
import { Roles } from '../src/shared/decorators/roles.decorator';
import { PrismaService } from '../src/shared/database/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import * as argon2 from 'argon2';

describe('Backend business integration', () => {
  const prisma = new PrismaService();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let userId: string;
  let stageId: string;
  let materialOneId: string;
  let materialTwoId: string;
  let repeatTaskId: string;
  let selectTaskId: string;
  let referenceAudioId: string;
  let submissionId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const user = await prisma.user.create({
      data: {
        email: `integration-${suffix}@yusro.local`,
        password: await argon2.hash('integration-password'),
        name: 'Integration Student',
        role: UserRole.SANTRI,
        status: AccountStatus.ACTIVE,
      },
    });
    userId = user.id;
    const earliestStage = await prisma.stage.aggregate({ _min: { order: true } });
    const fixtureStageOrder = (earliestStage._min.order ?? 0) - 1;
    const stage = await prisma.stage.create({
      // Keep this fixture before every existing stage without assuming a
      // particular seed value or colliding with a prior interrupted run.
      data: { title: `Integration Stage ${suffix}`, order: fixtureStageOrder, status: ContentStatus.ACTIVE },
    });
    stageId = stage.id;
    const materials = await prisma.$transaction([
      prisma.material.create({ data: { stageId, title: 'Material One', order: 1, isRequired: true, status: ContentStatus.ACTIVE } }),
      prisma.material.create({ data: { stageId, title: 'Material Two', order: 2, isRequired: true, status: ContentStatus.ACTIVE } }),
    ]);
    materialOneId = materials[0].id;
    materialTwoId = materials[1].id;
    const audio = await prisma.audioAsset.create({
      data: {
        type: AudioType.REFERENCE,
        status: AudioStatus.ACTIVE,
        originalName: 'reference.wav',
        objectKey: `integration/${suffix}/reference.wav`,
        mimeType: 'audio/wav',
        sizeBytes: 10,
        durationSeconds: 2,
      },
    });
    referenceAudioId = audio.id;
    const repeatTask = await prisma.task.create({
      data: {
        stageId,
        materialId: materialOneId,
        title: 'Repeat Task',
        type: TaskType.IMITATION,
        status: ContentStatus.ACTIVE,
        order: 1,
        referenceAudioId,
      },
    });
    repeatTaskId = repeatTask.id;
    const selectTask = await prisma.task.create({
      data: {
        stageId,
        materialId: materialOneId,
        title: 'Select Task',
        type: TaskType.QUIZ,
        status: ContentStatus.ACTIVE,
        order: 2,
        questions: {
          create: {
            prompt: 'Choose the correct answer',
            order: 1,
            options: { create: [{ text: 'Correct', isCorrect: true }, { text: 'Wrong', isCorrect: false }] },
          },
        },
      },
      include: { questions: { include: { options: true } } },
    });
    selectTaskId = selectTask.id;
  });

  afterAll(async () => {
		await prisma.evaluationJob.deleteMany({ where: { attempt: { userId } } });
		await prisma.attemptAnswer.deleteMany({ where: { attempt: { userId } } });
		await prisma.attempt.deleteMany({ where: { userId } });
		await prisma.audioAsset.deleteMany({ where: { objectKey: { startsWith: `recordings/${userId}/` } } });
    await prisma.evaluation.deleteMany({ where: { submission: { userId } } });
    await prisma.submission.deleteMany({ where: { userId } });
    await prisma.quizAnswer.deleteMany({ where: { attempt: { userId } } });
    await prisma.quizAttempt.deleteMany({ where: { userId } });
    await prisma.taskProgress.deleteMany({ where: { userId } });
    await prisma.materialProgress.deleteMany({ where: { userId } });
    await prisma.answerOption.deleteMany({ where: { question: { taskId: { in: [repeatTaskId, selectTaskId] } } } });
    await prisma.question.deleteMany({ where: { taskId: { in: [repeatTaskId, selectTaskId] } } });
    await prisma.task.deleteMany({ where: { id: { in: [repeatTaskId, selectTaskId] } } });
    await prisma.material.deleteMany({ where: { stageId } });
    await prisma.audioAsset.deleteMany({ where: { id: referenceAudioId } });
    await prisma.stage.delete({ where: { id: stageId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('authenticates a student and carries role/status claims', async () => {
    const users = new UserService(prisma);
    const auth = new AuthService(users, new JwtService({ secret: 'integration-secret' }));
    const login = await auth.login({ email: `integration-${suffix}@yusro.local`, password: 'integration-password' });
    const strategy = new JwtStrategy();
    const payload = new JwtService({ secret: 'integration-secret' }).verify(login.accessToken);
    expect(payload.role).toBe(UserRole.SANTRI);
    expect(payload.status).toBe(AccountStatus.ACTIVE);
    expect(strategy.validate(payload)).toMatchObject({ id: userId, role: UserRole.SANTRI });
  });

  it('allows only the declared role through RolesGuard', () => {
    class AdminController {}
    Roles(UserRole.ADMIN)(AdminController);
    const reflector = new Reflector();
    const guard = new RolesGuard(reflector);
    const context = { getHandler: () => () => undefined, getClass: () => AdminController, switchToHttp: () => ({ getRequest: () => ({ user: { role: UserRole.SANTRI } }) }) } as unknown as ExecutionContext;
    expect(() => guard.canActivate(context)).toThrow('Insufficient role permissions');
  });

  it('unlocks materials in order and completes material progress', async () => {
    const learning = new LearningService(prisma);
    let stages = await learning.getStages(userId);
    expect(stages.find(stage => stage.id === stageId)?.materials[0].isUnlocked).toBe(true);
    expect(stages.find(stage => stage.id === stageId)?.materials[1].isUnlocked).toBe(false);
    await learning.completeMaterial(userId, materialOneId);
    stages = await learning.getStages(userId);
    expect(stages.find(stage => stage.id === stageId)?.materials[1].isUnlocked).toBe(true);
  });

	it('submits a quiz attempt and records task progress', async () => {
    const quiz = new QuizService(prisma);
    const task = await prisma.task.findUniqueOrThrow({ where: { id: selectTaskId }, include: { questions: { include: { options: true } } } });
    const result = await quiz.submitAttempt(userId, selectTaskId, { answers: [{ questionId: task.questions[0].id, optionId: task.questions[0].options.find(option => option.isCorrect)!.id }] });
    expect(result.score).toBe(100);
    expect(await prisma.attempt.findFirst({ where: { id: result.attemptId, taskType: TaskType.QUIZ, userId }, include: { answers: true } })).toMatchObject({ correctCount: 1, questionCount: 1, answers: [{ questionId: task.questions[0].id }] });
    expect(await prisma.quizAttempt.count({ where: { userId, taskId: selectTaskId } })).toBe(0);
    expect(await prisma.taskProgress.findUnique({ where: { userId_taskId: { userId, taskId: selectTaskId } } })).not.toBeNull();
  });

	it('stores an audio submission and queues it for the evaluation worker', async () => {
		const fakeStorage = { putObject: jest.fn().mockResolvedValue(undefined), getObject: jest.fn(), deleteObject: jest.fn() };
		const fakeAudio = {
			getMetadata: jest.fn().mockResolvedValue({
				format: { duration: 2, format_name: 'wav' },
				streams: [{ codec_type: 'audio', codec_name: 'pcm_s16le', sample_rate: 16000, channels: 1, bits_per_sample: 16 }],
			}),
			getVolumeStats: jest.fn().mockResolvedValue({ meanDbfs: -20, maxDbfs: -10 }),
		};
		const imitation = new ImitationService(prisma, fakeStorage as never, fakeAudio as never);
		const wavHeader = Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt ');
		const result = await imitation.submitRecording(userId, repeatTaskId, { buffer: wavHeader, size: wavHeader.length, mimetype: 'audio/wav', originalname: 'recording.wav' } as Express.Multer.File);
    submissionId = result.submissionId;
    expect(result.status).toBe(EvaluationStatus.SUBMITTED);
    const status = await imitation.getSubmission(userId, submissionId);
		expect(status.status).toBe(EvaluationStatus.SUBMITTED);
		expect(status.score).toBeNull();
		expect(await prisma.evaluationJob.findFirst({ where: { attemptId: submissionId, status: 'QUEUED' } })).not.toBeNull();
  });

	it('calculates progress and statistics from canonical evaluated attempts', async () => {
		await prisma.attempt.update({
			where: { id: submissionId },
			data: { evaluationStatus: EvaluationStatus.EVALUATED, score: 93, feedbackCategory: 'SANGAT_BAIK', evaluatedAt: new Date() },
		});
		const progress = await new ProgressService(prisma).getProgress(userId);
		const statistics = await new StatisticsService(prisma).getStudentStatistics(userId);
    expect(progress.tasks.completed).toBeGreaterThanOrEqual(1);
    expect(progress.materials.completed).toBeGreaterThanOrEqual(1);
		expect(statistics.bestScore).toBe(93);
		expect(statistics.averageScore).toBe(93);
		expect(statistics.validEvaluationCount).toBe(1);
	});
});
