import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';

@Controller('profile')
export class ProfileController {
  @Get()
  stub(): never { throw new HttpException('Not Implemented', HttpStatus.NOT_IMPLEMENTED); }
}
