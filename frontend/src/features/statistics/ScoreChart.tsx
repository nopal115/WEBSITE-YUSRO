import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { formatDateTime } from '../../lib/utils/format';
import { formatScore } from '../dashboard/view';
import type { ChartPoint } from './types';

function ChartTooltip({ active, payload }: TooltipProps<number, string>): JSX.Element | null {
  const point = active ? (payload?.[0]?.payload as ChartPoint | undefined) : undefined;
  if (!point) return null;
  return (
    <div className="rounded-md border border-neutral-border bg-neutral-surface px-3 py-2 text-body-s text-text-primary shadow-raised">
      <p className="font-semibold">{point.taskTitle}</p>
      <p>Nilai {formatScore(point.score)}</p>
      <p className="text-text-secondary">{formatDateTime(point.submittedAt)}</p>
    </div>
  );
}

/**
 * Grafik garis nilai per urutan percobaan (SDD 7.7.14): sumbu Y tetap 0–100. Warna memakai
 * currentColor dari kelas token (tanpa hex). Alternatif teks: ringkasan aria-label + tabel sr-only.
 */
export function ScoreChart({ points, summary }: { points: ChartPoint[]; summary: string }): JSX.Element {
  return (
    <figure className="m-0">
      <div role="img" aria-label={summary} className="h-72 w-full text-text-secondary">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="currentColor" strokeOpacity={0.2} vertical={false} />
            <XAxis dataKey="sequence" stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 12 }} tickLine={false} allowDecimals={false} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 12 }} tickLine={false} width={36} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'currentColor', strokeOpacity: 0.3 }} />
            <Line type="monotone" dataKey="score" className="text-brand-primary" stroke="currentColor" strokeWidth={2} dot={{ r: 4, fill: 'currentColor' }} activeDot={{ r: 6 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Daftar nilai per percobaan</caption>
        <thead>
          <tr>
            <th scope="col">Percobaan</th>
            <th scope="col">Tugas</th>
            <th scope="col">Nilai</th>
            <th scope="col">Waktu</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.attemptId}>
              <td>{point.sequence}</td>
              <td>{point.taskTitle}</td>
              <td>{formatScore(point.score)}</td>
              <td>{formatDateTime(point.submittedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
