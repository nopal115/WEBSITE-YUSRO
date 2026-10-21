import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AudioStatus, AudioType, ContentStatus, TaskType } from '@prisma/client';
import { TaskService } from './task.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('TaskService', () => {
  let service: TaskService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      task: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      question: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _max: { order: 1 } }),
      },
      answerOption: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      taskProgress: {
        deleteMany: jest.fn(),
      },
      audioAsset: {
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      stage: {
        findUnique: jest.fn(),
      },
      material: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((callback) => {
        if (typeof callback === 'function') {
          return callback(mockPrisma);
        }
        return Promise.all(callback);
      }),
    };

    service = new TaskService(mockPrisma as unknown as PrismaService);
  });

  describe('deleteTask', () => {
    it('menolak penghapusan tugas jika sudah pernah dikerjakan santri (TASK_IN_USE)', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 'task-1',
        attempts: [{ id: 'attempt-1' }],
      });

      await expect(service.deleteTask('task-1')).rejects.toThrow(
        new ConflictException('TASK_IN_USE'),
      );
    });

    it('berhasil menghapus tugas jika belum pernah dikerjakan siapapun', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 'task-1',
        attempts: [],
      });
      mockPrisma.question.findMany.mockResolvedValue([{ id: 'q-1' }]);

      const result = await service.deleteTask('task-1');

      expect(result.success).toBe(true);
      expect(mockPrisma.task.delete).toHaveBeenCalledWith({ where: { id: 'task-1' } });
    });
  });

  describe('publishTask', () => {
    it('menolak penerbitan kuis jika tidak memiliki soal (TASK_INCOMPLETE)', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 'task-quiz-1',
        type: TaskType.QUIZ,
        questions: [],
      });

      await expect(service.publishTask('task-quiz-1')).rejects.toThrow(
        new UnprocessableEntityException('TASK_INCOMPLETE'),
      );
    });

    it('menolak penerbitan kuis jika kunci jawaban tidak valid / tidak ada jawaban benar (TASK_ANSWER_KEY_INVALID)', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 'task-quiz-1',
        type: TaskType.QUIZ,
        questions: [
          {
            id: 'q-1',
            options: [
              { id: 'opt-1', isCorrect: false },
              { id: 'opt-2', isCorrect: false },
            ],
          },
        ],
      });

      await expect(service.publishTask('task-quiz-1')).rejects.toThrow(
        new UnprocessableEntityException('TASK_ANSWER_KEY_INVALID'),
      );
    });

    it('menolak penerbitan kuis jika terdapat lebih dari satu jawaban benar (TASK_ANSWER_KEY_INVALID)', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 'task-quiz-1',
        type: TaskType.QUIZ,
        questions: [
          {
            id: 'q-1',
            options: [
              { id: 'opt-1', isCorrect: true },
              { id: 'opt-2', isCorrect: true },
            ],
          },
        ],
      });

      await expect(service.publishTask('task-quiz-1')).rejects.toThrow(
        new UnprocessableEntityException('TASK_ANSWER_KEY_INVALID'),
      );
    });

    it('menolak penerbitan imitasi jika tidak memiliki referenceAudioId (TASK_INCOMPLETE)', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 'task-imitation-1',
        type: TaskType.IMITATION,
        referenceAudioId: null,
      });

      await expect(service.publishTask('task-imitation-1')).rejects.toThrow(
        new UnprocessableEntityException('TASK_INCOMPLETE'),
      );
    });

    it('menolak penerbitan imitasi jika audio referensi tidak aktif (TASK_REFERENCE_NOT_ACTIVE)', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 'task-imitation-1',
        type: TaskType.IMITATION,
        referenceAudioId: 'audio-ref-1',
      });
      mockPrisma.audioAsset.findFirst.mockResolvedValue(null);

      await expect(service.publishTask('task-imitation-1')).rejects.toThrow(
        new UnprocessableEntityException('TASK_REFERENCE_NOT_ACTIVE'),
      );
    });

    it('berhasil menerbitkan tugas kuis yang lengkap dan valid', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 'task-quiz-1',
        type: TaskType.QUIZ,
        questions: [
          {
            id: 'q-1',
            options: [
              { id: 'opt-1', isCorrect: true },
              { id: 'opt-2', isCorrect: false },
            ],
          },
        ],
      });
      mockPrisma.task.update.mockResolvedValue({
        id: 'task-quiz-1',
        status: ContentStatus.ACTIVE,
      });

      const result = await service.publishTask('task-quiz-1');
      expect(result.status).toBe(ContentStatus.ACTIVE);
      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-quiz-1' },
        data: { status: ContentStatus.ACTIVE },
      });
    });
  });

  describe('addQuestion & updateQuestion', () => {
    it('menolak penambahan soal dengan kurang dari 2 opsi jawaban', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 'task-1',
        type: TaskType.QUIZ,
      });

      await expect(
        service.addQuestion('task-1', {
          prompt: 'Pilihlah huruf...',
          options: [{ text: 'Alif', isCorrect: true }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('menolak penambahan soal tanpa tepat satu jawaban benar', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 'task-1',
        type: TaskType.QUIZ,
      });

      await expect(
        service.addQuestion('task-1', {
          prompt: 'Pilihlah huruf...',
          options: [
            { text: 'Alif', isCorrect: false },
            { text: 'Ba', isCorrect: false },
          ],
        }),
      ).rejects.toThrow('Tepat satu pilihan harus bertanda benar.');
    });

    it('berhasil menambahkan butir soal valid', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 'task-1',
        type: TaskType.QUIZ,
      });
      mockPrisma.question.create.mockResolvedValue({
        id: 'q-new',
        prompt: 'Pilihlah huruf...',
        order: 2,
        options: [
          { id: 'opt-1', text: 'Alif', isCorrect: true },
          { id: 'opt-2', text: 'Ba', isCorrect: false },
        ],
      });

      const result = await service.addQuestion('task-1', {
        prompt: 'Pilihlah huruf...',
        options: [
          { text: 'Alif', isCorrect: true },
          { text: 'Ba', isCorrect: false },
        ],
      });

      expect(result.id).toBe('q-new');
      expect(mockPrisma.question.create).toHaveBeenCalled();
    });
  });
});
