import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreateMaterialDto, CreateStageDto, UpdateMaterialDto, UpdateStageDto } from './dto/content.dto';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async getStages() {
    const stages = await this.prisma.stage.findMany({
      orderBy: { order: 'asc' },
      include: {
        materials: {
          select: { id: true, progress: { select: { id: true }, take: 1 } },
        },
      },
    });

    return stages.map((stage) => {
      const isReferenced = stage.materials.some((m) => m.progress.length > 0);
      return {
        id: stage.id,
        code: `l${String(stage.order).padStart(3, '0')}`,
        title: stage.title,
        description: stage.description,
        orderIndex: stage.order,
        status: stage.status,
        materialCount: stage.materials.length,
        isReferenced,
      };
    });
  }

  async createStage(input: CreateStageDto) {
    const title = input.title.trim();
    if (!title) throw new BadRequestException('Judul tahapan wajib diisi.');

    const max = await this.prisma.stage.aggregate({ _max: { order: true } });
    const order = (max._max.order ?? 0) + 1;

    const created = await this.prisma.stage.create({
      data: {
        title,
        description: input.description?.trim() || null,
        status: input.status ?? ContentStatus.DRAFT,
        order,
      },
    });

    return {
      id: created.id,
      code: `l${String(created.order).padStart(3, '0')}`,
      title: created.title,
      description: created.description,
      orderIndex: created.order,
      status: created.status,
      materialCount: 0,
      isReferenced: false,
    };
  }

  async updateStage(id: string, input: UpdateStageDto) {
    const stage = await this.prisma.stage.findUnique({
      where: { id },
      include: { materials: { select: { id: true } } },
    });
    if (!stage) throw new NotFoundException('Tahapan tidak ditemukan.');

    const updated = await this.prisma.stage.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      include: { materials: { select: { id: true } } },
    });

    return {
      id: updated.id,
      code: `l${String(updated.order).padStart(3, '0')}`,
      title: updated.title,
      description: updated.description,
      orderIndex: updated.order,
      status: updated.status,
      materialCount: updated.materials.length,
      isReferenced: updated.materials.length > 0,
    };
  }

  async deleteStage(id: string) {
    const stage = await this.prisma.stage.findUnique({
      where: { id },
      include: { materials: { select: { id: true } } },
    });
    if (!stage) throw new NotFoundException('Tahapan tidak ditemukan.');

    if (stage.materials.length > 0) {
      throw new ConflictException('CONTENT_IN_USE');
    }

    return this.prisma.stage.delete({ where: { id } });
  }

  async reorderStages(orderedIds: string[]) {
    const existing = await this.prisma.stage.findMany({ select: { id: true } });
    if (existing.length !== orderedIds.length) {
      throw new UnprocessableEntityException('CONTENT_REORDER_INCOMPLETE');
    }

    await this.prisma.$transaction(async (tx) => {
      // Set to temporary negative orders to prevent unique constraint conflict during reorder
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.stage.update({
          where: { id: orderedIds[i] },
          data: { order: -(i + 1) },
        });
      }
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.stage.update({
          where: { id: orderedIds[i] },
          data: { order: i + 1 },
        });
      }
    });

    return this.getStages();
  }

  async getMaterials(stageId: string) {
    const stage = await this.prisma.stage.findUnique({
      where: { id: stageId },
      select: { order: true },
    });
    if (!stage) throw new NotFoundException('Tahapan tidak ditemukan.');

    const materials = await this.prisma.material.findMany({
      where: { stageId },
      orderBy: { order: 'asc' },
      include: {
        tasks: { select: { id: true } },
        progress: { select: { id: true }, take: 1 },
        audioAssets: { select: { audioId: true } },
      },
    });

    return materials.map((mat) => {
      let blockCount = mat.audioAssets.length + (mat.contentImageUrl ? 1 : 0);
      if (mat.contentText) {
        if (mat.contentText.startsWith('[')) {
          try {
            blockCount = JSON.parse(mat.contentText).length;
          } catch {
            blockCount += 1;
          }
        } else {
          blockCount += 1;
        }
      }

      const isReferenced = mat.progress.length > 0 || mat.tasks.length > 0;
      return {
        id: mat.id,
        stageId: mat.stageId,
        code: `l${String(stage.order).padStart(3, '0')}m${String(mat.order).padStart(3, '0')}`,
        title: mat.title,
        summary: mat.contentText?.startsWith('[') ? null : mat.contentText,
        orderIndex: mat.order,
        isRequired: mat.isRequired,
        status: mat.status,
        blockCount,
        taskCount: mat.tasks.length,
        isReferenced,
      };
    });
  }

  async getMaterial(id: string) {
    const mat = await this.prisma.material.findUnique({
      where: { id },
      include: {
        stage: { select: { order: true } },
        tasks: { select: { id: true } },
        progress: { select: { id: true }, take: 1 },
        audioAssets: { select: { audioId: true } },
      },
    });
    if (!mat) throw new NotFoundException('Materi tidak ditemukan.');

    let blockCount = mat.audioAssets.length + (mat.contentImageUrl ? 1 : 0);
    if (mat.contentText) {
      if (mat.contentText.startsWith('[')) {
        try {
          blockCount = JSON.parse(mat.contentText).length;
        } catch {
          blockCount += 1;
        }
      } else {
        blockCount += 1;
      }
    }

    return {
      id: mat.id,
      stageId: mat.stageId,
      code: `l${String(mat.stage.order).padStart(3, '0')}m${String(mat.order).padStart(3, '0')}`,
      title: mat.title,
      summary: mat.contentText?.startsWith('[') ? null : mat.contentText,
      orderIndex: mat.order,
      isRequired: mat.isRequired,
      status: mat.status,
      blockCount,
      taskCount: mat.tasks.length,
      isReferenced: mat.progress.length > 0 || mat.tasks.length > 0,
    };
  }

  async createMaterial(input: CreateMaterialDto) {
    const stage = await this.prisma.stage.findUnique({ where: { id: input.stageId } });
    if (!stage) throw new NotFoundException('Tahapan tidak ditemukan.');

    const max = await this.prisma.material.aggregate({
      where: { stageId: input.stageId },
      _max: { order: true },
    });
    const order = (max._max.order ?? 0) + 1;

    const created = await this.prisma.material.create({
      data: {
        stageId: input.stageId,
        title: input.title.trim(),
        contentText: input.summary?.trim() || null,
        isRequired: input.isRequired ?? true,
        status: input.status ?? ContentStatus.DRAFT,
        order,
      },
    });

    return {
      id: created.id,
      stageId: created.stageId,
      code: `l${String(stage.order).padStart(3, '0')}m${String(created.order).padStart(3, '0')}`,
      title: created.title,
      summary: created.contentText,
      orderIndex: created.order,
      isRequired: created.isRequired,
      status: created.status,
      blockCount: 0,
      taskCount: 0,
      isReferenced: false,
    };
  }

  async updateMaterial(id: string, input: UpdateMaterialDto) {
    const mat = await this.prisma.material.findUnique({
      where: { id },
      include: {
        stage: { select: { order: true } },
        tasks: { select: { id: true } },
        progress: { select: { id: true }, take: 1 },
      },
    });
    if (!mat) throw new NotFoundException('Materi tidak ditemukan.');

    const updated = await this.prisma.material.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.summary !== undefined ? { contentText: input.summary?.trim() || null } : {}),
        ...(input.isRequired !== undefined ? { isRequired: input.isRequired } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      include: {
        stage: { select: { order: true } },
        tasks: { select: { id: true } },
        progress: { select: { id: true }, take: 1 },
        audioAssets: { select: { audioId: true } },
      },
    });

    return {
      id: updated.id,
      stageId: updated.stageId,
      code: `l${String(updated.stage.order).padStart(3, '0')}m${String(updated.order).padStart(3, '0')}`,
      title: updated.title,
      summary: updated.contentText,
      orderIndex: updated.order,
      isRequired: updated.isRequired,
      status: updated.status,
      blockCount: updated.audioAssets.length,
      taskCount: updated.tasks.length,
      isReferenced: updated.progress.length > 0 || updated.tasks.length > 0,
    };
  }

  async deleteMaterial(id: string) {
    const mat = await this.prisma.material.findUnique({
      where: { id },
      include: {
        tasks: { select: { id: true } },
        progress: { select: { id: true }, take: 1 },
      },
    });
    if (!mat) throw new NotFoundException('Materi tidak ditemukan.');

    if (mat.tasks.length > 0 || mat.progress.length > 0) {
      throw new ConflictException('CONTENT_IN_USE');
    }

    await this.prisma.materialAudio.deleteMany({ where: { materialId: id } });
    return this.prisma.material.delete({ where: { id } });
  }

  async reorderMaterials(orderedIds: string[]) {
    if (orderedIds.length === 0) return [];
    const first = await this.prisma.material.findUnique({ where: { id: orderedIds[0] } });
    if (!first) throw new NotFoundException('Materi tidak ditemukan.');

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.material.update({
          where: { id: orderedIds[i] },
          data: { order: -(i + 1) },
        });
      }
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.material.update({
          where: { id: orderedIds[i] },
          data: { order: i + 1 },
        });
      }
    });

    return this.getMaterials(first.stageId);
  }

  async getBlocks(materialId: string) {
    const mat = await this.prisma.material.findUnique({
      where: { id: materialId },
      include: {
        audioAssets: {
          include: {
            audio: {
              select: { id: true, originalName: true, durationMs: true, durationSeconds: true },
            },
          },
        },
      },
    });
    if (!mat) throw new NotFoundException('Materi tidak ditemukan.');

    if (mat.contentText && mat.contentText.startsWith('[')) {
      try {
        const parsed = JSON.parse(mat.contentText);
        if (Array.isArray(parsed)) {
          return Promise.all(
            parsed.map(async (b, index) => {
              let audioData = null;
              if (b.audioId) {
                const a = await this.prisma.audioAsset.findUnique({
                  where: { id: b.audioId },
                  select: { id: true, originalName: true, durationMs: true, durationSeconds: true },
                });
                if (a) {
                  audioData = {
                    id: a.id,
                    originalName: a.originalName,
                    durationMs: a.durationMs ?? Math.round((a.durationSeconds ?? 0) * 1000),
                  };
                }
              }
              return {
                id: b.id || `b-${index + 1}`,
                type: b.type,
                orderIndex: index + 1,
                textContent: b.textContent ?? null,
                arabicContent: b.arabicContent ?? null,
                transliteration: b.transliteration ?? null,
                imageUrl: b.imageUrl ?? null,
                audioId: b.audioId ?? null,
                audio: audioData,
              };
            }),
          );
        }
      } catch {
        // Fallback to legacy structure
      }
    }

    const blocks: any[] = [];
    if (mat.contentText) {
      blocks.push({
        id: `b-${blocks.length + 1}`,
        type: 'TEXT',
        orderIndex: blocks.length + 1,
        textContent: mat.contentText,
        arabicContent: null,
        transliteration: null,
        imageUrl: null,
        audioId: null,
        audio: null,
      });
    }
    if (mat.contentImageUrl) {
      blocks.push({
        id: `b-${blocks.length + 1}`,
        type: 'IMAGE',
        orderIndex: blocks.length + 1,
        textContent: null,
        arabicContent: null,
        transliteration: null,
        imageUrl: mat.contentImageUrl,
        audioId: null,
        audio: null,
      });
    }
    for (const link of mat.audioAssets) {
      const a = link.audio;
      blocks.push({
        id: `b-${blocks.length + 1}`,
        type: 'AUDIO',
        orderIndex: blocks.length + 1,
        textContent: null,
        arabicContent: null,
        transliteration: null,
        imageUrl: null,
        audioId: a.id,
        audio: {
          id: a.id,
          originalName: a.originalName,
          durationMs: a.durationMs ?? Math.round((a.durationSeconds ?? 0) * 1000),
        },
      });
    }

    return blocks;
  }

  async saveBlocks(materialId: string, blocks: any[]) {
    const mat = await this.prisma.material.findUnique({ where: { id: materialId } });
    if (!mat) throw new NotFoundException('Materi tidak ditemukan.');

    // Simpan representasi JSON blok ke material.contentText
    const serializedBlocks = blocks.map((b, i) => ({
      id: b.id || `b-${i + 1}`,
      type: b.type,
      textContent: b.textContent || null,
      arabicContent: b.arabicContent || null,
      transliteration: b.transliteration || null,
      audioId: b.audioId || null,
      imageUrl: b.imageUrl || null,
    }));

    await this.prisma.$transaction(async (tx) => {
      await tx.material.update({
        where: { id: materialId },
        data: {
          contentText: JSON.stringify(serializedBlocks),
        },
      });

      // Sinkronkan MaterialAudio untuk audio blocks
      await tx.materialAudio.deleteMany({ where: { materialId } });
      const audioIds = blocks.filter((b) => b.type === 'AUDIO' && b.audioId).map((b) => b.audioId);
      for (const aId of audioIds) {
        await tx.materialAudio.create({
          data: {
            materialId,
            audioId: aId,
          },
        });
      }
    });

    return this.getBlocks(materialId);
  }

  listPublished() {
    return this.prisma.stage.findMany({
      where: { status: ContentStatus.ACTIVE },
      orderBy: { order: 'asc' },
      include: {
        materials: {
          where: { status: ContentStatus.ACTIVE },
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  listAllForAdmin() {
    return this.getStages();
  }
}
