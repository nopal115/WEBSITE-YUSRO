import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
@Controller('progress')
export class ProgressController { @Get() stub(): never { throw new HttpException('Not Implemented', HttpStatus.NOT_IMPLEMENTED); } }
