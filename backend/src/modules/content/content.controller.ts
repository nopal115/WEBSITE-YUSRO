import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { ContentService } from './content.service';
import { CreateMaterialDto, CreateStageDto, UpdateMaterialDto, UpdateStageDto } from './dto/content.dto';

@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  listPublished() {
    return this.contentService.listPublished();
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  listAllForAdmin() {
    return this.contentService.listAllForAdmin();
  }

  @Post('stages')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  createStage(@Body() input: CreateStageDto) {
    return this.contentService.createStage(input);
  }

  @Patch('stages/:stageId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updateStage(
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() input: UpdateStageDto,
  ) {
    return this.contentService.updateStage(stageId, input);
  }

  @Post('stages/:stageId/materials')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  createMaterial(
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() input: CreateMaterialDto,
  ) {
    return this.contentService.createMaterial(stageId, input);
  }

  @Patch('materials/:materialId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updateMaterial(
    @Param('materialId', ParseUUIDPipe) materialId: string,
    @Body() input: UpdateMaterialDto,
  ) {
    return this.contentService.updateMaterial(materialId, input);
  }
}
