import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
@Controller('student-admin')
export class StudentAdminController { @Get() stub(): never { throw new HttpException('Not Implemented', HttpStatus.NOT_IMPLEMENTED); } }
