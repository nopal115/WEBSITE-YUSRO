import { ArrowLeft, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { formatScore } from '../dashboard/view';
import { ErrorState, ListSkeleton } from '../learning/QueryStates';
import { useStatistics, useStatisticsChart } from '../progress/hooks';
import { ScoreChart } from './ScoreChart';
import type { ChartTrend, StatisticsChart } from './types';
import { shouldShowChart, TREND_LABEL } from './view';

const TREND_ICON: Record<ChartTrend, typeof TrendingUp> = { UP: TrendingUp, DOWN: TrendingDown, FLAT: Minus, INSUFFICIENT_DATA: Minus };

function StatTile({ label, value, note }: { label: string; value: string; note?: string }): JSX.Element {
  return (
    <div className="rounded-md border border-neutral-border bg-neutral-surface p-4">
      <p className="text-label text-text-muted">{label}</p>
      <p className="mt-2 text-h1 text-brand-primary">{value}</p>
      {note && <p className="mt-1 text-body-s text-text-secondary">{note}</p>}
    </div>
  );
}

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

// SDD 7.7.14 (UI-STAT-01, UI-STAT-02). [REKOMENDASI] Tampilan disusun dari SDD dan UI kit; Figma 19 belum dicocokkan.
export function StatisticsPage(): JSX.Element {
  const stats = useStatistics();
  const chart = useStatisticsChart();

  const back = (
    <Link to="/progress" className="flex min-h-11 items-center gap-2 self-start text-body text-brand-primary hover:underline">
      <ArrowLeft size={20} aria-hidden="true" />
      Progress
    </Link>
  );

  if (stats.isPending) {
    return (
      <div className="mx-auto flex max-w-[1040px] flex-col gap-6">
        {back}
        <ListSkeleton rows={2} />
      </div>
    );
  }
  if (stats.isError) {
    return (
      <div className="mx-auto flex max-w-[1040px] flex-col gap-6">
        {back}
        <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
      </div>
    );
  }

  const data = stats.data;
  const noScore = 'Belum ada hasil evaluasi.';
  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-6">
      {back}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="MATERI SELESAI" value={String(data.materialsCompleted)} />
        <StatTile label="TUGAS SELESAI" value={String(data.tasksCompleted)} />
        <StatTile label="NILAI RATA-RATA" value={data.averageScore === null ? '—' : formatScore(data.averageScore)} note={data.averageScore === null ? noScore : undefined} />
        <StatTile label="NILAI TERBAIK" value={data.bestScore === null ? '—' : formatScore(data.bestScore)} note={data.bestScore === null ? noScore : undefined} />
        <div className="col-span-2 lg:col-span-1">
          <StatTile label="PROGRESS" value={`${data.learningProgressPct}%`} />
        </div>
      </div>
      {/* [REKOMENDASI] Informasi saja; percobaan gagal tidak memengaruhi angka mana pun (SDD 3.14.2). */}
      {data.failedAttempts > 0 && (
        <p className="text-body-s text-text-secondary">{data.failedAttempts} percobaan gagal diproses dan tidak dihitung dalam statistik.</p>
      )}

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
    </div>
  );
}
