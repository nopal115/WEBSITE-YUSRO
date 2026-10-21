import { Controller, Get, Param, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportService } from './report.service';

@Controller('report')
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('pdf')
  async getPdf(@Req() request: Request & { user: { id: string } }, @Res() response: Response) {
    const pdf = await this.reportService.generateStudentPdf(request.user.id);
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="yusro-report.pdf"',
    });
    response.send(Buffer.from(pdf));
  }

  @Get('certificate')
  async getLatestCertificate(@Req() request: Request & { user: { id: string } }, @Res() response: Response) {
    const { pdf, studentCode } = await this.reportService.generateCertificatePdf(request.user.id);
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Syahadah-${studentCode}.pdf"`,
    });
    response.send(Buffer.from(pdf));
  }

  @Get('certificate/:stageId')
  async getStageCertificate(
    @Param('stageId') stageId: string,
    @Req() request: Request & { user: { id: string } },
    @Res() response: Response,
  ) {
    const { pdf, studentCode, stageTitle } = await this.reportService.generateCertificatePdf(
      request.user.id,
      stageId,
    );
    const safeTitle = stageTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Syahadah-${studentCode}-${safeTitle}.pdf"`,
    });
    response.send(Buffer.from(pdf));
  }
}
