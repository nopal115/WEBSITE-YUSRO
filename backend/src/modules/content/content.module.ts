import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

// SDD 3.5 - Content Module
@Module({ controllers: [ContentController], providers: [ContentService] })
export class ContentModule {}
