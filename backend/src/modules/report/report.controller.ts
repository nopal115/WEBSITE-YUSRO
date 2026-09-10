import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
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
		response.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="yusro-report.pdf"' });
		response.send(Buffer.from(pdf));
	}
}
