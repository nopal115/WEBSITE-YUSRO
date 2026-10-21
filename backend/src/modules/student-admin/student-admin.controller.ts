import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AccountStatus, UserRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Request, Response } from 'express';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { ProgressService } from '../progress/progress.service';
import { ReportService } from '../report/report.service';
import { StatisticsService } from '../statistics/statistics.service';
import { StudentAdminService } from './student-admin.service';

class UpdateStudentStatusDto {
  @IsEnum(AccountStatus, { message: 'Status akun tidak valid.' })
  status!: AccountStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Alasan maksimal 255 karakter.' })
  reason?: string;
}

type AuthenticatedRequest = Request & { user: { id: string } };

@Controller('admin')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class StudentAdminController {
  constructor(
    private readonly studentAdminService: StudentAdminService,
    private readonly progressService: ProgressService,
    private readonly statisticsService: StatisticsService,
    private readonly reportService: ReportService,
  ) {}

  @Get('students')
  listStudents(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('stageId') stageId?: string,
    @Query('status') status?: AccountStatus,
    @Query('progressMin') progressMin?: string,
    @Query('progressMax') progressMax?: string,
    @Query('scoreMin') scoreMin?: string,
    @Query('scoreMax') scoreMax?: string,
    @Query('sort') sort?: string,
  ) {
    return this.studentAdminService.listStudents({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      q,
      stageId,
      status,
      progressMin: progressMin ? Number(progressMin) : undefined,
      progressMax: progressMax ? Number(progressMax) : undefined,
      scoreMin: scoreMin ? Number(scoreMin) : undefined,
      scoreMax: scoreMax ? Number(scoreMax) : undefined,
      sort,
    });
  }

  @Get('students/:id')
  getStudentDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentAdminService.getStudentDetail(id);
  }

  @Patch('students/:id/status')
  setStudentStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateStudentStatusDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.studentAdminService.setStudentStatus(id, input.status, input.reason, request.user.id);
  }

  @Get('students/:id/statistics')
  getStudentStatistics(@Param('id', ParseUUIDPipe) id: string) {
    return this.statisticsService.getStudentStatistics(id);
  }

  @Get('students/:id/chart')
  getStudentChart(@Param('id', ParseUUIDPipe) id: string) {
    return this.statisticsService.getChartData(id);
  }

  @Get('students/:id/history')
  getStudentHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.progressService.getHistory(id, Number(page) || 1, Number(limit) || 20);
  }

  @Get('students/:id/report/pdf')
  async downloadStudentReport(@Param('id', ParseUUIDPipe) id: string, @Res() response: Response) {
    const pdf = await this.reportService.generateStudentPdf(id);
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Laporan-Santri-${id}.pdf"`,
    });
    response.send(Buffer.from(pdf));
  }
}
