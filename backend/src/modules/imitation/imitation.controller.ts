import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
@Controller('imitation')
export class ImitationController { @Get() stub(): never { throw new HttpException('Not Implemented', HttpStatus.NOT_IMPLEMENTED); } }
