import { Injectable } from '@nestjs/common';

import { BrowserService } from '../../shared/browser/browser.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { StatisticsService } from '../statistics/statistics.service';

@Injectable()
export class ReportService {
	constructor(
		private readonly browser: BrowserService,
		private readonly prisma: PrismaService,
		private readonly statistics: StatisticsService,
	) {}

	async generateStudentPdf(userId: string): Promise<Uint8Array> {
		const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, studentId: true, name: true } });
		if (!user) throw new Error('User not found');
		const summary = await this.statistics.getStudentStatistics(userId);
		const history = await this.statistics.getStudentHistory(userId);
		const html = `<!doctype html><html><body><h1>Laporan Hasil Belajar</h1><p>Nama: ${this.escape(user.name)}</p><p>ID Santri: ${this.escape(user.studentId ?? '-')}</p><p>Progress: ${summary.progress}%</p><p>Materi selesai: ${summary.materialsCompleted}</p><p>Tugas selesai: ${summary.tasksCompleted}</p><p>Nilai rata-rata: ${summary.averageScore ?? '-'}</p><p>Nilai terbaik: ${summary.bestScore ?? '-'}</p><h2>Riwayat Nilai</h2><ul>${history.map(item => `<li>${item.score} - ${item.feedback ?? '-'} - ${item.evaluatedAt?.toISOString() ?? '-'}</li>`).join('')}</ul><p>Tanggal laporan: ${new Date().toISOString()}</p></body></html>`;
		return this.browser.renderHtmlToPdf(html);
	}

	private escape(value: string): string {
		return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
	}
}
