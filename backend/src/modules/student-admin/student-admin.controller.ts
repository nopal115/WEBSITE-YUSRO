import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { AccountStatus, UserRole } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { StudentAdminService } from './student-admin.service';

class UpdateStudentStatusDto {
  @IsEnum(AccountStatus)
  status!: AccountStatus;
}

@Controller('student-admin')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class StudentAdminController {
  constructor(private readonly studentAdminService: StudentAdminService) {}

  @Get()
  listStudents(@Query('search') search?: string) {
    return this.studentAdminService.listStudents(search);
  }

  @Patch(':studentId/status')
  setStudentStatus(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() input: UpdateStudentStatusDto,
  ) {
    return this.studentAdminService.setStudentStatus(studentId, input.status);
  }
}
