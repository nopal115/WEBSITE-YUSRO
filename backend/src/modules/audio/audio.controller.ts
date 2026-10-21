import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AudioType, UserRole } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { AudioService } from './audio.service';

class UploadAudioDto {
  @IsEnum(AudioType, { message: 'Tipe audio tidak valid.' })
  type!: AudioType;
}

class AdminAudioQueryDto {
  @IsOptional()
  @IsEnum(AudioType, { message: 'Jenis audio tidak valid.' })
  kind?: AudioType;

  @IsOptional()
  @IsEnum(AudioType, { message: 'Tipe audio tidak valid.' })
  type?: AudioType;
}

@Controller('admin/audio')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AudioController {
  constructor(private readonly audioService: AudioService) {}

  @Get()
  list(@Query() query: AdminAudioQueryDto) {
    const selectedType = query.kind || query.type;
    return this.audioService.listAudio(selectedType);
  }

  @Get(':audioId/url')
  getUrl(@Param('audioId', ParseUUIDPipe) audioId: string) {
    return this.audioService.getPlayableUrl(audioId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('kind') kind?: AudioType,
    @Body('type') type?: AudioType,
  ) {
    const selectedType = kind || type || AudioType.LEARNING;
    return this.audioService.uploadAudio(file, selectedType);
  }

  @Post(':audioId/archive')
  archive(@Param('audioId', ParseUUIDPipe) audioId: string) {
    return this.audioService.archiveAudio(audioId);
  }

  @Post(':audioId/replace')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  replace(
    @Param('audioId', ParseUUIDPipe) audioId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.audioService.replaceAudio(audioId, file);
  }
}
