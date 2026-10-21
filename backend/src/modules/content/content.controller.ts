import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { ContentService } from './content.service';
import {
  CreateMaterialDto,
  CreateStageDto,
  ReorderDto,
  SaveBlocksDto,
  UpdateMaterialDto,
  UpdateStageDto,
} from './dto/content.dto';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get('stages')
  getStages() {
    return this.contentService.getStages();
  }

  @Post('stages')
  createStage(@Body() input: CreateStageDto) {
    return this.contentService.createStage(input);
  }

  @Patch('stages/reorder')
  reorderStages(@Body() input: ReorderDto) {
    return this.contentService.reorderStages(input.orderedIds);
  }

  @Patch('stages/:id')
  updateStage(@Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateStageDto) {
    return this.contentService.updateStage(id, input);
  }

  @Delete('stages/:id')
  deleteStage(@Param('id', ParseUUIDPipe) id: string) {
    return this.contentService.deleteStage(id);
  }

  @Get('materials')
  getMaterials(@Query('stageId', ParseUUIDPipe) stageId: string) {
    return this.contentService.getMaterials(stageId);
  }

  @Post('materials')
  createMaterial(@Body() input: CreateMaterialDto) {
    return this.contentService.createMaterial(input);
  }

  @Patch('materials/reorder')
  reorderMaterials(@Body() input: ReorderDto) {
    return this.contentService.reorderMaterials(input.orderedIds);
  }

  @Get('materials/:id')
  getMaterial(@Param('id', ParseUUIDPipe) id: string) {
    return this.contentService.getMaterial(id);
  }

  @Patch('materials/:id')
  updateMaterial(@Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateMaterialDto) {
    return this.contentService.updateMaterial(id, input);
  }

  @Delete('materials/:id')
  deleteMaterial(@Param('id', ParseUUIDPipe) id: string) {
    return this.contentService.deleteMaterial(id);
  }

  @Get('materials/:id/blocks')
  getBlocks(@Param('id', ParseUUIDPipe) id: string) {
    return this.contentService.getBlocks(id);
  }

  @Put('materials/:id/blocks')
  saveBlocks(@Param('id', ParseUUIDPipe) id: string, @Body() input: SaveBlocksDto) {
    return this.contentService.saveBlocks(id, input.blocks);
  }
}
