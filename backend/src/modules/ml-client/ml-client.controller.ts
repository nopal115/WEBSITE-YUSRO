import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
@Controller('ml-client')
export class MlClientController { @Get() stub(): never { throw new HttpException('Not Implemented', HttpStatus.NOT_IMPLEMENTED); } }
