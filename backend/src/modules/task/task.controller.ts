import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
@Controller('task')
export class TaskController { @Get() stub(): never { throw new HttpException('Not Implemented', HttpStatus.NOT_IMPLEMENTED); } }
