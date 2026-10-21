import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { TaskService } from './task.service';
import {
  AddQuestionDto,
  AdminTaskQueryDto,
  CreateTaskDto,
  UpdateQuestionDto,
  UpdateTaskDto,
} from './dto/task.dto';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminTaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get('tasks')
  listTasks(@Query() query: AdminTaskQueryDto) {
    return this.taskService.listAllForAdmin(query.type);
  }

  @Get('tasks/:taskId')
  getTask(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.taskService.getTask(taskId);
  }

  @Post('tasks')
  createTask(@Body() input: CreateTaskDto) {
    return this.taskService.createTask(input);
  }

  @Patch('tasks/:taskId')
  updateTask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() input: UpdateTaskDto,
  ) {
    return this.taskService.updateTask(taskId, input);
  }

  @Delete('tasks/:taskId')
  deleteTask(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.taskService.deleteTask(taskId);
  }

  @Post('tasks/:taskId/publish')
  publishTask(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.taskService.publishTask(taskId);
  }

  @Post('tasks/:taskId/questions')
  addQuestion(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() input: AddQuestionDto,
  ) {
    return this.taskService.addQuestion(taskId, input);
  }

  @Patch('questions/:questionId')
  updateQuestion(
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() input: UpdateQuestionDto,
  ) {
    return this.taskService.updateQuestion(questionId, input);
  }

  @Delete('questions/:questionId')
  deleteQuestion(@Param('questionId', ParseUUIDPipe) questionId: string) {
    return this.taskService.deleteQuestion(questionId);
  }
}
