import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
@Controller('report')
export class ReportController { @Get() stub(): never { throw new HttpException('Not Implemented', HttpStatus.NOT_IMPLEMENTED); } }
