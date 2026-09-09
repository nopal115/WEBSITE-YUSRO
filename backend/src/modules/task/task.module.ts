import { Module } from '@nestjs/common';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
// SDD 3.7 - Task Module
@Module({ controllers: [TaskController], providers: [TaskService] })
export class TaskModule {}
