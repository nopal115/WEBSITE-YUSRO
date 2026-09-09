import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
@Controller('statistics')
export class StatisticsController { @Get() stub(): never { throw new HttpException('Not Implemented', HttpStatus.NOT_IMPLEMENTED); } }
