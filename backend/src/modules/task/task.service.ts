import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
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
        OR: [{ materialId: null }, { material: { status: ContentStatus.ACTIVE } }],
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

  async listAllForAdmin(type?: TaskType) {
    const tasks = await this.prisma.task.findMany({
      where: type ? { type } : {},
      orderBy: [{ stage: { order: 'asc' } }, { order: 'asc' }],
      include: {
        stage: { select: { id: true, title: true, order: true } },
        material: { select: { id: true, title: true, order: true } },
        referenceAudio: { select: { id: true, originalName: true, mimeType: true, durationSeconds: true, durationMs: true } },
        questions: {
          orderBy: { order: 'asc' },
          include: {
            options: { orderBy: { id: 'asc' } },
            audio: { select: { id: true, originalName: true } },
          },
        },
        attempts: { select: { id: true }, take: 1 },
      },
    });

    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      type: task.type,
      status: task.status,
      order: task.order,
      orderIndex: task.order,
      stageId: task.stageId,
      stageTitle: task.stage?.title ?? '',
      materialId: task.materialId,
      materialTitle: task.material?.title ?? null,
      referenceAudioId: task.referenceAudioId,
      referenceAudio: task.referenceAudio,
      questionCount: task.questions.length,
      questions: task.questions.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        order: q.order,
        audioId: q.audioId,
        audioName: q.audio?.originalName ?? null,
        options: q.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          label: opt.text,
          isCorrect: opt.isCorrect,
        })),
      })),
      isReferenced: task.attempts.length > 0,
    }));
  }

  async getTask(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        stage: { select: { id: true, title: true, order: true } },
        material: { select: { id: true, title: true, order: true } },
        referenceAudio: { select: { id: true, originalName: true, mimeType: true, durationSeconds: true, durationMs: true } },
        questions: {
          orderBy: { order: 'asc' },
          include: {
            options: { orderBy: { id: 'asc' } },
            audio: { select: { id: true, originalName: true } },
          },
        },
      },
    });
    if (!task) throw new NotFoundException('Tugas tidak ditemukan.');

    return {
      id: task.id,
      title: task.title,
      type: task.type,
      status: task.status,
      order: task.order,
      stageId: task.stageId,
      stageTitle: task.stage?.title ?? '',
      materialId: task.materialId,
      materialTitle: task.material?.title ?? null,
      referenceAudioId: task.referenceAudioId,
      referenceAudio: task.referenceAudio,
      questionCount: task.questions.length,
      questions: task.questions.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        order: q.order,
        audioId: q.audioId,
        audioName: q.audio?.originalName ?? null,
        options: q.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          label: opt.text,
          isCorrect: opt.isCorrect,
        })),
      })),
    };
  }

  async createTask(input: CreateTaskDto) {
    if (!input.title.trim()) throw new BadRequestException('Judul tugas tidak boleh kosong.');
    if (
      input.questions?.some(
        (question) => !question.prompt.trim() || question.options.some((option) => !option.text.trim()),
      )
    ) {
      throw new BadRequestException('Soal dan pilihan jawaban tidak boleh kosong.');
    }
    const stage = await this.prisma.stage.findUnique({ where: { id: input.stageId }, select: { id: true } });
    if (!stage) throw new NotFoundException('Tahapan tidak ditemukan.');
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
      this.rethrowWriteError(error, 'Urutan tugas atau soal sudah digunakan.');
    }
  }

  async updateTask(taskId: string, input: UpdateTaskDto) {
    if (input.title !== undefined && !input.title.trim()) {
      throw new BadRequestException('Judul tugas tidak boleh kosong.');
    }
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, stageId: true, type: true, referenceAudioId: true, materialId: true },
    });
    if (!task) throw new NotFoundException('Tugas tidak ditemukan.');
    const materialId = input.materialId === null ? undefined : input.materialId ?? task.materialId ?? undefined;
    const referenceAudioId =
      input.referenceAudioId === null ? undefined : input.referenceAudioId ?? task.referenceAudioId ?? undefined;
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
      this.rethrowWriteError(error, 'Urutan tugas sudah digunakan.');
    }
  }

  async deleteTask(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { attempts: { select: { id: true }, take: 1 } },
    });
    if (!task) throw new NotFoundException('Tugas tidak ditemukan.');

    if (task.attempts.length > 0) {
      throw new ConflictException('TASK_IN_USE');
    }

    await this.prisma.$transaction(async (tx) => {
      const questions = await tx.question.findMany({ where: { taskId }, select: { id: true } });
      const qIds = questions.map((q) => q.id);
      await tx.answerOption.deleteMany({ where: { questionId: { in: qIds } } });
      await tx.question.deleteMany({ where: { taskId } });
      await tx.taskProgress.deleteMany({ where: { taskId } });
      await tx.task.delete({ where: { id: taskId } });
    });

    return { success: true, message: 'Tugas berhasil dihapus.' };
  }

  async publishTask(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        questions: {
          include: { options: true },
        },
      },
    });
    if (!task) throw new NotFoundException('Tugas tidak ditemukan.');

    if (task.type === TaskType.QUIZ) {
      if (task.questions.length === 0) {
        throw new UnprocessableEntityException('TASK_INCOMPLETE');
      }
      for (const q of task.questions) {
        if (q.options.length < 2) {
          throw new UnprocessableEntityException('TASK_INCOMPLETE');
        }
        const correctCount = q.options.filter((o) => o.isCorrect).length;
        if (correctCount !== 1) {
          throw new UnprocessableEntityException('TASK_ANSWER_KEY_INVALID');
        }
      }
    } else if (task.type === TaskType.IMITATION) {
      if (!task.referenceAudioId) {
        throw new UnprocessableEntityException('TASK_INCOMPLETE');
      }
      const ref = await this.prisma.audioAsset.findFirst({
        where: { id: task.referenceAudioId, status: AudioStatus.ACTIVE },
      });
      if (!ref) {
        throw new UnprocessableEntityException('TASK_REFERENCE_NOT_ACTIVE');
      }
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: { status: ContentStatus.ACTIVE },
    });
  }

  async addQuestion(
    taskId: string,
    input: { prompt: string; audioId?: string; order?: number; options: Array<{ text?: string; label?: string; isCorrect: boolean }> },
  ) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Tugas tidak ditemukan.');
    if (task.type !== TaskType.QUIZ) throw new BadRequestException('Hanya tugas kuis yang memiliki butir soal.');

    if (!input.options || input.options.length < 2) {
      throw new BadRequestException('Soal harus memiliki minimal 2 pilihan jawaban.');
    }
    const correctCount = input.options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      throw new BadRequestException('Tepat satu pilihan harus bertanda benar.');
    }

    const maxOrder = (await this.prisma.question.aggregate({ where: { taskId }, _max: { order: true } }))._max.order ?? 0;
    const order = input.order || maxOrder + 1;

    return this.prisma.question.create({
      data: {
        taskId,
        prompt: input.prompt.trim(),
        order,
        audioId: input.audioId || null,
        options: {
          create: input.options.map((opt) => ({
            text: (opt.text || opt.label || '').trim(),
            isCorrect: opt.isCorrect,
          })),
        },
      },
      include: { options: true },
    });
  }

  async updateQuestion(
    questionId: string,
    input: { prompt?: string; audioId?: string; options?: Array<{ id?: string; text?: string; label?: string; isCorrect: boolean }> },
  ) {
    const q = await this.prisma.question.findUnique({ where: { id: questionId }, include: { options: true } });
    if (!q) throw new NotFoundException('Soal tidak ditemukan.');

    if (input.options) {
      if (input.options.length < 2) throw new BadRequestException('Soal harus memiliki minimal 2 pilihan jawaban.');
      const correctCount = input.options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) throw new BadRequestException('Tepat satu pilihan harus bertanda benar.');

      await this.prisma.$transaction(async (tx) => {
        await tx.answerOption.deleteMany({ where: { questionId } });
        for (const opt of input.options!) {
          await tx.answerOption.create({
            data: {
              questionId,
              text: (opt.text || opt.label || '').trim(),
              isCorrect: opt.isCorrect,
            },
          });
        }
      });
    }

    return this.prisma.question.update({
      where: { id: questionId },
      data: {
        ...(input.prompt !== undefined ? { prompt: input.prompt.trim() } : {}),
        ...(input.audioId !== undefined ? { audioId: input.audioId || null } : {}),
      },
      include: { options: true },
    });
  }

  async deleteQuestion(questionId: string) {
    const q = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!q) throw new NotFoundException('Soal tidak ditemukan.');

    await this.prisma.$transaction([
      this.prisma.answerOption.deleteMany({ where: { questionId } }),
      this.prisma.question.delete({ where: { id: questionId } }),
    ]);

    return { success: true, message: 'Soal berhasil dihapus.' };
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
    const audioIds = [...new Set(questions?.flatMap((question) => (question.audioId ? [question.audioId] : [])) ?? [])];
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
