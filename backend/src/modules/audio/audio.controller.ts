import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AudioType, UserRole } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { AudioService } from './audio.service';

class UploadAudioDto {
  @IsEnum(AudioType)
  type!: AudioType;
}

@Controller('audio')
export class AudioController {
  constructor(private readonly audioService: AudioService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  list(@Query('type') type?: AudioType) {
    if (type && !Object.values(AudioType).includes(type)) {
      throw new BadRequestException('Invalid audio type');
    }
    return this.audioService.listAudio(type);
  }

  @Get(':audioId/url')
  getUrl(@Param('audioId', ParseUUIDPipe) audioId: string) {
    return this.audioService.getPlayableUrl(audioId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 25 * 1024 * 1024 } }))
  upload(@UploadedFile() file: Express.Multer.File, @Body() input: UploadAudioDto) {
    return this.audioService.uploadAudio(file, input.type);
  }
}
