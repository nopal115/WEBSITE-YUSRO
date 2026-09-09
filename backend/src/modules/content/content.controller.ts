import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';

@Controller('content')
export class ContentController {
  @Get()
  stub(): never { throw new HttpException('Not Implemented', HttpStatus.NOT_IMPLEMENTED); }
}
