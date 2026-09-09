import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';

@Controller('user')
export class UserController {
  @Get()
  stub(): never { throw new HttpException('Not Implemented', HttpStatus.NOT_IMPLEMENTED); }
}
