import type { UseQueryResult } from '@tanstack/react-query';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { StatTile } from '../../components/ui/StatTile';
import { formatScore } from '../dashboard/view';
import { ErrorState } from '../learning/QueryStates';
import { ScoreChart } from './ScoreChart';
import type { ChartTrend, Statistics, StatisticsChart } from './types';
import { shouldShowChart, TREND_LABEL } from './view';

const TREND_ICON: Record<ChartTrend, typeof TrendingUp> = { UP: TrendingUp, DOWN: TrendingDown, FLAT: Minus, INSUFFICIENT_DATA: Minus };

function ChartSection({ chart }: { chart: StatisticsChart }): JSX.Element {
  const scores = chart.points.map((point) => point.score);
  const TrendIcon = TREND_ICON[chart.trend];
  const summary = `Grafik nilai: ${scores.length} hasil evaluasi, terendah ${formatScore(Math.min(...scores))}, tertinggi ${formatScore(Math.max(...scores))}, tren ${TREND_LABEL[chart.trend].toLowerCase()}.`;
  return (
    <>
      {/* Tren sebagai teks + ikon, bukan warna saja. */}
      <p className="flex items-center gap-2 text-body-s text-text-secondary">
        <TrendIcon size={18} aria-hidden="true" />
        Tren tiga hasil terakhir: <span className="font-semibold text-text-primary">{TREND_LABEL[chart.trend]}</span>
      </p>
      <ScoreChart points={chart.points} summary={summary} />
    </>
  );
}

/**
 * Lima angka statistik dan grafik nilai (SDD 7.7.14), dipakai Statistik Santri dan Detail Santri (Admin).
 * Memuat Recharts lewat ScoreChart: hanya diimpor halaman yang dimuat terpisah (React.lazy).
 */
export function StatisticsView({ stats, chart }: { stats: Statistics; chart: UseQueryResult<StatisticsChart> }): JSX.Element {
  const noScore = 'Belum ada hasil evaluasi.';
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="MATERI SELESAI" value={String(stats.materialsCompleted)} />
        <StatTile label="TUGAS SELESAI" value={String(stats.tasksCompleted)} />
        <StatTile label="NILAI RATA-RATA" value={stats.averageScore === null ? '—' : formatScore(stats.averageScore)} note={stats.averageScore === null ? noScore : undefined} />
        <StatTile label="NILAI TERBAIK" value={stats.bestScore === null ? '—' : formatScore(stats.bestScore)} note={stats.bestScore === null ? noScore : undefined} />
        <div className="col-span-2 lg:col-span-1">
          <StatTile label="PROGRESS" value={`${stats.learningProgressPct}%`} />
        </div>
      </div>
      {/* [REKOMENDASI] Informasi saja; percobaan gagal tidak memengaruhi angka mana pun (SDD 3.14.2). */}
      {stats.failedAttempts > 0 && <p className="text-body-s text-text-secondary">{stats.failedAttempts} percobaan gagal diproses dan tidak dihitung dalam statistik.</p>}

      <Card className="flex flex-col gap-4">
        <h2 className="text-h3">Perkembangan nilai</h2>
        {chart.isPending ? (
          <div className="h-72 animate-pulse rounded-md bg-neutral-border motion-reduce:animate-none" aria-busy="true" aria-label="Memuat" />
        ) : chart.isError ? (
          <ErrorState error={chart.error} onRetry={() => void chart.refetch()} />
        ) : shouldShowChart(chart.data.points) ? (
          <ChartSection chart={chart.data} />
        ) : (
          <p className="text-body text-text-secondary">Grafik akan muncul setelah terdapat sekurang-kurangnya dua hasil evaluasi.</p>
        )}
      </Card>
    </>
  );
}
