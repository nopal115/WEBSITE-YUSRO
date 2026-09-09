import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
@Controller('monitoring')
export class MonitoringController { @Get() stub(): never { throw new HttpException('Not Implemented', HttpStatus.NOT_IMPLEMENTED); } }
