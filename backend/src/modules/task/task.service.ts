import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AudioStatus, AudioType, ContentStatus, Prisma, TaskType } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';

@Injectable()
export class TaskService {
  constructor(private readonly prisma: PrismaService) {}

  listPublished() {
    return this.prisma.task.findMany({
      where: {
        status: ContentStatus.ACTIVE,
        stage: { status: ContentStatus.ACTIVE },
        OR: [
          { materialId: null },
          { material: { status: ContentStatus.ACTIVE } },
        ],
      },
      orderBy: [{ stage: { order: 'asc' } }, { order: 'asc' }],
      select: {
        id: true,
        stageId: true,
        materialId: true,
        title: true,
        type: true,
        order: true,
        stage: { select: { title: true, order: true } },
        material: { select: { title: true, order: true } },
        referenceAudio: {
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            durationSeconds: true,
          },
        },
        questions: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            prompt: true,
            audioId: true,
            order: true,
            options: {
              orderBy: { id: 'asc' },
              select: { id: true, text: true },
            },
          },
        },
      },
    });
  }

  listAllForAdmin() {
    return this.prisma.task.findMany({
      orderBy: [{ stage: { order: 'asc' } }, { order: 'asc' }],
      include: {
        stage: { select: { title: true, order: true } },
        material: { select: { title: true, order: true } },
        referenceAudio: { select: { id: true, originalName: true, mimeType: true, durationSeconds: true } },
        questions: {
          orderBy: { order: 'asc' },
          include: { options: { orderBy: { id: 'asc' } } },
        },
      },
    });
  }

  async createTask(input: CreateTaskDto) {
    if (!input.title.trim()) throw new BadRequestException('Task title cannot be empty');
    if (input.questions?.some((question) => !question.prompt.trim() || question.options.some((option) => !option.text.trim()))) {
      throw new BadRequestException('Question prompts and options cannot be empty');
    }
    const stage = await this.prisma.stage.findUnique({ where: { id: input.stageId }, select: { id: true } });
    if (!stage) throw new NotFoundException('Stage not found');
    await this.assertMaterialBelongsToStage(input.materialId, input.stageId);
    await this.assertReferenceAudio(input.referenceAudioId);
    await this.assertQuestionAudio(input.questions);
    this.validateTaskContent(input.type, input.referenceAudioId, input.questions);

    try {
      return await this.prisma.task.create({
        data: {
          stageId: input.stageId,
          materialId: input.materialId,
          title: input.title.trim(),
          type: input.type,
          status: input.status ?? ContentStatus.DRAFT,
          order: input.order,
          referenceAudioId: input.referenceAudioId,
          ...(input.questions?.length
            ? {
                questions: {
                  create: input.questions.map((question) => ({
                    prompt: question.prompt.trim(),
                    order: question.order,
                    audioId: question.audioId,
                    options: {
                      create: question.options.map((option) => ({
                        text: option.text.trim(),
                        isCorrect: option.isCorrect,
                      })),
                    },
                  })),
                },
              }
            : {}),
        },
        include: { questions: { orderBy: { order: 'asc' }, include: { options: true } } },
      });
    } catch (error) {
      this.rethrowWriteError(error, 'Task order or question order already exists');
    }
  }

  async updateTask(taskId: string, input: UpdateTaskDto) {
    if (input.title !== undefined && !input.title.trim()) {
      throw new BadRequestException('Task title cannot be empty');
    }
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, stageId: true, type: true, referenceAudioId: true, materialId: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    const materialId = input.materialId === null ? undefined : input.materialId ?? task.materialId ?? undefined;
    const referenceAudioId = input.referenceAudioId === null ? undefined : input.referenceAudioId ?? task.referenceAudioId ?? undefined;
    await this.assertMaterialBelongsToStage(materialId, task.stageId);
    await this.assertReferenceAudio(referenceAudioId);
    this.validateTaskContent(task.type, referenceAudioId, undefined, false);

    try {
      return await this.prisma.task.update({
        where: { id: taskId },
        data: {
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.order !== undefined ? { order: input.order } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.materialId !== undefined ? { materialId: input.materialId } : {}),
          ...(input.referenceAudioId !== undefined ? { referenceAudioId: input.referenceAudioId } : {}),
        },
      });
    } catch (error) {
      this.rethrowWriteError(error, 'Task not found or order already exists');
    }
  }

  private async assertMaterialBelongsToStage(materialId: string | undefined, stageId: string): Promise<void> {
    if (!materialId) return;
    const material = await this.prisma.material.findFirst({ where: { id: materialId, stageId }, select: { id: true } });
    if (!material) throw new BadRequestException('Material must belong to the selected stage');
  }

  private async assertReferenceAudio(audioId?: string): Promise<void> {
    if (!audioId) return;
    const audio = await this.prisma.audioAsset.findFirst({
      where: { id: audioId, type: AudioType.REFERENCE, status: AudioStatus.ACTIVE },
      select: { id: true },
    });
    if (!audio) throw new BadRequestException('Reference audio is unavailable');
  }

  private async assertQuestionAudio(questions?: CreateTaskDto['questions']): Promise<void> {
    const audioIds = [...new Set(questions?.flatMap((question) => question.audioId ? [question.audioId] : []) ?? [])];
    if (!audioIds.length) return;
    const count = await this.prisma.audioAsset.count({ where: { id: { in: audioIds }, status: AudioStatus.ACTIVE } });
    if (count !== audioIds.length) throw new BadRequestException('Question audio is unavailable');
  }

  private validateTaskContent(
    type: TaskType,
    referenceAudioId?: string,
    questions?: CreateTaskDto['questions'],
    requireQuizQuestions = true,
  ): void {
    if (type === TaskType.IMITATION && !referenceAudioId) {
      throw new BadRequestException('Imitation tasks require reference audio');
    }
    if (type === TaskType.QUIZ) {
      if (!questions && !requireQuizQuestions) return;
      if (!questions?.length) throw new BadRequestException('Quiz tasks require at least one question');
      for (const question of questions) {
        if (question.options.filter((option) => option.isCorrect).length !== 1) {
          throw new BadRequestException('Each quiz question must have exactly one correct option');
        }
      }
    } else if (questions?.length) {
      throw new BadRequestException('Only quiz tasks can contain questions');
    }
  }

  private rethrowWriteError(error: unknown, conflictMessage: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new ConflictException(conflictMessage);
      if (error.code === 'P2025') throw new NotFoundException('Task not found');
    }
    throw error;
  }
}
