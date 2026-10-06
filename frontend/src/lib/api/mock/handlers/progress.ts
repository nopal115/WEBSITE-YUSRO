// SDD 5.11 (progress, riwayat), 5.12 (statistik), 5.13 (laporan PDF).
import { findUser } from '../db';
import { ok, paginate } from '../http';
import { mockPdf } from '../media';
import type { MockRoute } from '../router';
import { chartView, historyItems, progressView, statisticsView } from '../views';

export const progressRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/progress',
    access: 'SANTRI',
    handler: (req) => ok(progressView(req.userId as string)),
  },
  {
    method: 'GET',
    pattern: '/progress/history',
    access: 'SANTRI',
    handler: (req) => {
      const { data, meta } = paginate(historyItems(req.userId as string), req.query, 20);
      return ok(data, { meta });
    },
  },
  {
    method: 'GET',
    pattern: '/statistics',
    access: 'SANTRI',
    handler: (req) => ok(statisticsView(req.userId as string)),
  },
  {
    method: 'GET',
    pattern: '/statistics/chart',
    access: 'SANTRI',
    handler: (req) => ok(chartView(req.userId as string)),
  },
  {
    method: 'GET',
    pattern: '/report/pdf',
    access: 'SANTRI',
    handler: (req) => {
      const user = findUser(req.userId);
      const date = new Date().toISOString().slice(0, 10);
      return {
        status: 200,
        blob: mockPdf(`Laporan Yusro [DATA CONTOH] - ${user.studentCode} - ${date}`),
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Laporan-${user.studentCode}-${date}.pdf"` },
      };
    },
  },
];
