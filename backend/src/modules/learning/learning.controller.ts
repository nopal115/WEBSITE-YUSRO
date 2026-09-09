import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
@Controller('learning')
export class LearningController { @Get() stub(): never { throw new HttpException('Not Implemented', HttpStatus.NOT_IMPLEMENTED); } }
