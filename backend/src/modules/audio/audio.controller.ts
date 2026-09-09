import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
@Controller('audio')
export class AudioController { @Get() stub(): never { throw new HttpException('Not Implemented', HttpStatus.NOT_IMPLEMENTED); } }
