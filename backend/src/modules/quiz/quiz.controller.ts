import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
@Controller('quiz')
export class QuizController { @Get() stub(): never { throw new HttpException('Not Implemented', HttpStatus.NOT_IMPLEMENTED); } }
