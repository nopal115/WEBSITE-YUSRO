import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, studentId: true, name: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const summary = await this.statistics.getStudentStatistics(userId);
    const history = await this.statistics.getStudentHistory(userId);
    const html = `<!doctype html><html><body><h1>Laporan Hasil Belajar</h1><p>Nama: ${this.escape(user.name)}</p><p>ID Santri: ${this.escape(user.studentId ?? '-')}</p><p>Progress: ${summary.progress}%</p><p>Materi selesai: ${summary.materialsCompleted}</p><p>Tugas selesai: ${summary.tasksCompleted}</p><p>Nilai rata-rata: ${summary.averageScore ?? '-'}</p><p>Nilai terbaik: ${summary.bestScore ?? '-'}</p><h2>Riwayat Nilai</h2><ul>${history.map(item => `<li>${item.score} - ${item.feedback ?? '-'} - ${item.evaluatedAt?.toISOString() ?? '-'}</li>`).join('')}</ul><p>Tanggal laporan: ${new Date().toISOString()}</p></body></html>`;
    return this.browser.renderHtmlToPdf(html);
  }

  async generateCertificatePdf(
    userId: string,
    stageId?: string,
  ): Promise<{ pdf: Uint8Array; stageTitle: string; studentName: string; studentCode: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, studentId: true, name: true },
    });
    if (!user) throw new NotFoundException('User not found');

    let stage = null;
    if (stageId) {
      stage = await this.prisma.stage.findUnique({
        where: { id: stageId },
      });
    }

    if (!stage) {
      // Ambil tahapan pertama yang aktif jika tidak dispesifikasikan
      stage = await this.prisma.stage.findFirst({
        where: { status: ContentStatus.ACTIVE },
        orderBy: { order: 'asc' },
      });
    }

    const stageTitle = stage?.title ?? 'Tahapan Pembelajaran Makharijul Huruf';
    const studentName = user.name;
    const studentCode = user.studentId ?? 'YSR-000001';

    const completionDate = new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'long',
      timeZone: 'Asia/Jakarta',
    }).format(new Date());

    const html = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Syahadah Kelulusan Tahapan - ${this.escape(studentName)}</title>
  <style>
    @page { size: A4 landscape; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      background-color: #FBF9F4;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #16211D;
      -webkit-print-color-adjust: exact;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
    }
    .cert-frame {
      border: 8px double #0F4C5C;
      outline: 2px solid #FFB703;
      outline-offset: -14px;
      padding: 32px 48px;
      width: 100%;
      height: 100%;
      background: #FFFFFF;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .bismillah {
      font-size: 26px;
      color: #0F4C5C;
      margin-bottom: 6px;
    }
    .arabic-title {
      font-size: 30px;
      font-weight: bold;
      color: #0F4C5C;
      margin: 0;
      letter-spacing: 1px;
    }
    .cert-badge {
      display: inline-block;
      background: #0F4C5C;
      color: #FFB703;
      padding: 4px 18px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 8px;
    }
    .cert-subtitle {
      font-size: 14px;
      color: #4A5A54;
      margin-top: 6px;
      font-weight: 500;
    }
    .recipient-intro {
      font-size: 14px;
      color: #6A766F;
      margin-top: 16px;
      font-style: italic;
    }
    .student-name {
      font-size: 28px;
      font-weight: 800;
      color: #0F4C5C;
      border-bottom: 2px solid #FFB703;
      display: inline-block;
      padding-bottom: 4px;
      margin: 8px 0 4px 0;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .student-code {
      font-size: 13px;
      color: #6A766F;
      font-weight: 600;
    }
    .cert-statement {
      font-size: 14px;
      color: #4A5A54;
      max-width: 680px;
      margin: 12px auto 0 auto;
      line-height: 1.6;
    }
    .stage-title {
      font-size: 17px;
      font-weight: 700;
      color: #0F4C5C;
      margin: 4px 0;
    }
    .footer-signatures {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 16px;
      padding: 0 32px;
    }
    .sign-box {
      text-align: center;
      width: 220px;
    }
    .seal {
      width: 76px;
      height: 76px;
      border-radius: 50%;
      border: 3px dashed #FFB703;
      background: #0F4C5C;
      color: #FFB703;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: bold;
      margin: 0 auto;
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    .sign-title {
      font-size: 12px;
      color: #6A766F;
      margin-bottom: 36px;
    }
    .sign-name {
      font-size: 13px;
      font-weight: bold;
      color: #16211D;
      border-top: 1px solid #C6DCE1;
      padding-top: 4px;
    }
  </style>
</head>
<body>
  <div class="cert-frame">
    <div>
      <div class="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
      <div class="arabic-title">شَهَادَةُ إِتْمَامِ الْمَرْحَلَةِ</div>
      <div class="cert-badge">SYAHADAH KELULUSAN TAHAPAN</div>
      <div class="cert-subtitle">Metode Pembelajaran Yusro • Makharijul Huruf Al-Qur'an</div>
    </div>

    <div>
      <div class="recipient-intro">Diberikan dengan apresiasi tinggi atas ikhtiar dan ketekunan belajar kepada:</div>
      <div class="student-name">${this.escape(studentName)}</div>
      <div class="student-code">ID Santri: ${this.escape(studentCode)}</div>
      <div class="cert-statement">
        Telah berhasil menyelesaikan secara tuntas seluruh materi pembelajaran, latihan audio mandiri, dan evaluasi bacaan pada:
        <div class="stage-title">${this.escape(stageTitle)}</div>
        dengan dedikasi istiqamah, kriteria tuntas, dan memenuhi standar pengucapan makhraj Metode Yusro.
      </div>
    </div>

    <div class="footer-signatures">
      <div class="sign-box">
        <div class="sign-title">Pembimbing / Dewan Penguji</div>
        <div class="sign-name">Tim Asatidz Yusro</div>
      </div>

      <div class="seal">
        <div style="font-size: 18px; line-height: 1;">ي</div>
        <div style="letter-spacing: 1px; margin-top: 2px;">YUSRO</div>
        <div style="font-size: 7px; opacity: 0.9;">TERVERIFIKASI</div>
      </div>

      <div class="sign-box">
        <div class="sign-title">Diterbitkan pada: ${completionDate}</div>
        <div class="sign-name">Pusat Riset AI - BRIN & Yusro</div>
      </div>
    </div>
  </div>
</body>
</html>`;

    const pdf = await this.browser.renderHtmlToPdf(html, { landscape: true });
    return { pdf, stageTitle, studentName, studentCode };
  }

  private escape(value: string): string {
    return value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[character] ?? character,
    );
  }
}
