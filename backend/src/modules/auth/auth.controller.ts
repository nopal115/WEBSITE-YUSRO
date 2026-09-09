import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Get()
  stub(): never { throw new HttpException('Not Implemented', HttpStatus.NOT_IMPLEMENTED); }
}
