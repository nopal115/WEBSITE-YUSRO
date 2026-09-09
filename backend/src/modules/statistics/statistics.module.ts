import { Module } from '@nestjs/common';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
// SDD 3.14 - Statistics Module
@Module({ controllers: [StatisticsController], providers: [StatisticsService] })
export class StatisticsModule {}
