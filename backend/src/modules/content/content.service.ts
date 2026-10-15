import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreateMaterialDto, CreateStageDto, UpdateMaterialDto, UpdateStageDto } from './dto/content.dto';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  listPublished() {
    return this.prisma.stage.findMany({
      where: { status: ContentStatus.ACTIVE },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        order: true,
        materials: {
          where: { status: ContentStatus.ACTIVE },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            contentText: true,
            contentImageUrl: true,
            order: true,
            isRequired: true,
            audioAssets: {
              where: { audio: { status: 'ACTIVE' } },
              select: {
                audio: {
                  select: {
                    id: true,
                    originalName: true,
                    mimeType: true,
                    durationSeconds: true,
                    objectKey: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  listAllForAdmin() {
    return this.prisma.stage.findMany({
      orderBy: { order: 'asc' },
      include: { materials: { orderBy: { order: 'asc' } } },
    });
  }

  async createStage(input: CreateStageDto) {
    const title = input.title.trim();
    if (!title) throw new BadRequestException('Stage title cannot be empty');
    try {
      return await this.prisma.stage.create({
        data: {
          title,
          description: input.description?.trim() || null,
          order: input.order,
          status: input.status ?? ContentStatus.DRAFT,
        },
      });
    } catch (error) {
      this.rethrowWriteError(error, 'Stage order already exists');
    }
  }

  async updateStage(stageId: string, input: UpdateStageDto) {
    if (input.title !== undefined && !input.title.trim()) {
      throw new BadRequestException('Stage title cannot be empty');
    }
    try {
      return await this.prisma.stage.update({
        where: { id: stageId },
        data: {
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.description !== undefined
            ? { description: input.description === null ? null : input.description.trim() || null }
            : {}),
          ...(input.order !== undefined ? { order: input.order } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
      });
    } catch (error) {
      this.rethrowWriteError(error, 'Stage not found or order already exists');
    }
  }

  async createMaterial(stageId: string, input: CreateMaterialDto) {
    const title = input.title.trim();
    if (!title) throw new BadRequestException('Material title cannot be empty');
    const stage = await this.prisma.stage.findUnique({ where: { id: stageId }, select: { id: true } });
    if (!stage) throw new NotFoundException('Stage not found');
    try {
      return await this.prisma.material.create({
        data: {
          stageId,
          title,
          contentText: input.contentText,
          contentImageUrl: input.contentImageUrl,
          order: input.order,
          isRequired: input.isRequired ?? true,
          status: input.status ?? ContentStatus.DRAFT,
        },
      });
    } catch (error) {
      this.rethrowWriteError(error, 'Material order already exists in this stage');
    }
  }

  async updateMaterial(materialId: string, input: UpdateMaterialDto) {
    if (input.title !== undefined && !input.title.trim()) {
      throw new BadRequestException('Material title cannot be empty');
    }
    try {
      return await this.prisma.material.update({
        where: { id: materialId },
        data: {
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.contentText !== undefined ? { contentText: input.contentText } : {}),
          ...(input.contentImageUrl !== undefined ? { contentImageUrl: input.contentImageUrl } : {}),
          ...(input.order !== undefined ? { order: input.order } : {}),
          ...(input.isRequired !== undefined ? { isRequired: input.isRequired } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
      });
    } catch (error) {
      this.rethrowWriteError(error, 'Material not found or order already exists');
    }
  }

  private rethrowWriteError(error: unknown, conflictMessage: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new ConflictException(conflictMessage);
      if (error.code === 'P2025') throw new NotFoundException('Content record not found');
    }
    throw error;
  }
}
