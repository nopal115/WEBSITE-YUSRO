import { Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LearningService } from './learning.service';

type AuthenticatedRequest = Request & { user: { id: string } };

@Controller('learning')
@UseGuards(JwtAuthGuard)
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Get('stages')
  getStages(@Req() request: AuthenticatedRequest) {
    return this.learningService.getStages(request.user.id);
  }

  @Get('stages/:stageId/materials')
  getStageMaterials(
    @Req() request: AuthenticatedRequest,
    @Param('stageId', ParseUUIDPipe) stageId: string,
  ) {
    return this.learningService.getStageMaterials(request.user.id, stageId);
  }

  @Get('materials/:materialId')
  getMaterial(
    @Req() request: AuthenticatedRequest,
    @Param('materialId', ParseUUIDPipe) materialId: string,
  ) {
    return this.learningService.getMaterial(request.user.id, materialId);
  }

  @Get('continue')
  getContinue(@Req() request: AuthenticatedRequest) {
    return this.learningService.getContinue(request.user.id);
  }

  @Post('materials/:materialId/complete')
  completeMaterial(
    @Req() request: AuthenticatedRequest,
    @Param('materialId', ParseUUIDPipe) materialId: string,
  ) {
    return this.learningService.completeMaterial(request.user.id, materialId, true);
  }
}
