import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
@Controller('evaluation')
export class EvaluationController { @Get() stub(): never { throw new HttpException('Not Implemented', HttpStatus.NOT_IMPLEMENTED); } }
