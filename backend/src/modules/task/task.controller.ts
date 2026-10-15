import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { TaskService } from './task.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';

@Controller('task')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get()
  listPublished() {
    return this.taskService.listPublished();
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  listAllForAdmin() {
    return this.taskService.listAllForAdmin();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  createTask(@Body() input: CreateTaskDto) {
    return this.taskService.createTask(input);
  }

  @Patch(':taskId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updateTask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() input: UpdateTaskDto,
  ) {
    return this.taskService.updateTask(taskId, input);
  }
}
