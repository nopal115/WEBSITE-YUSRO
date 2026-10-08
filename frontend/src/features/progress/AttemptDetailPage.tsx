import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { formatDateTime } from '../../lib/utils/format';
import { formatScore } from '../dashboard/view';
import { imitationApi } from '../imitation/api';
import type { SubmissionStatus } from '../imitation/types';
import { ErrorState, ListSkeleton } from '../learning/QueryStates';
import { quizApi } from '../quiz/api';
import { QuizResultView } from '../quiz/QuizResultView';

const backLink = (
  <Link to="/riwayat" className="flex min-h-11 items-center gap-2 self-start text-body text-brand-primary hover:underline">
    <ArrowLeft size={20} aria-hidden="true" />
    Kembali ke riwayat
  </Link>
);

function Loading(): JSX.Element {
  return (
    <div className="mx-auto max-w-[1040px]">
      <ListSkeleton rows={3} />
    </div>
  );
}

function Failure({ error, onRetry }: { error: Error; onRetry: () => void }): JSX.Element {
  // 404: tidak ditemukan atau bukan milik santri (SDD 6.4.4); tanpa COBA LAGI.
  return (
    <div className="mx-auto max-w-[1040px]">
      <ErrorState error={error} onRetry={onRetry} backTo="/riwayat" backLabel="Kembali ke riwayat" />
    </div>
  );
}

// Detail percobaan Dengar-Pilih dari riwayat (GET /quiz/attempts/:id). Tanpa KERJAKAN LAGI.
function QuizAttemptDetail({ attemptId }: { attemptId: string }): JSX.Element {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['progress', 'attempt', attemptId],
    queryFn: ({ signal }) => quizApi.getAttempt(attemptId, signal),
  });

  if (isPending) return <Loading />;
  if (isError) return <Failure error={error} onRetry={() => void refetch()} />;

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6">
      <div>
        <h1 className="text-h2">Percobaan ke-{data.attemptNo}</h1>
        <p className="mt-1 text-body-s text-text-secondary">{formatDateTime(data.submittedAt)}</p>
      </div>
      <QuizResultView result={data} questions={data.questions} actions={backLink} />
    </div>
  );
}

/** Nomor percobaan dan waktu hanya bila ada di respons (K2); tiap status membawa field berbeda (SDD 5.10). */
function imitationMeta(status: SubmissionStatus): string[] {
  switch (status.evaluationStatus) {
    case 'EVALUATED':
      return [`Percobaan ke-${status.attemptNo}`, `Dievaluasi ${formatDateTime(status.evaluatedAt)}`];
    case 'FAILED':
      return [`Gagal diproses ${formatDateTime(status.failedAt)}`];
    default:
      return [`Dikirim ${formatDateTime(status.submittedAt)}`];
  }
}

// Detail percobaan Dengar-Tirukan dari riwayat (GET imitation/submissions/:id), tanpa pemantauan.
function ImitationAttemptDetail({ submissionId }: { submissionId: string }): JSX.Element {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['progress', 'attempt', 'imitation', submissionId],
    queryFn: ({ signal }) => imitationApi.getSubmission(submissionId, signal),
  });

  if (isPending) return <Loading />;
  if (isError) return <Failure error={error} onRetry={() => void refetch()} />;

  const evaluated = data.evaluationStatus === 'EVALUATED';
  const failed = data.evaluationStatus === 'FAILED';
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6">
      <div>
        <h1 className="text-h2">Percobaan Dengar-Tirukan</h1>
        {imitationMeta(data).map((line) => (
          <p key={line} className="mt-1 text-body-s text-text-secondary">
            {line}
          </p>
        ))}
      </div>
      <Card className="flex flex-col gap-4">
        <div>
          <Pill status={evaluated ? 'selesai' : failed ? 'gagal' : 'diproses'}>{evaluated ? 'Selesai' : failed ? 'Gagal diproses' : 'Diproses'}</Pill>
        </div>
        <div>
          <p className="text-label text-text-muted">NILAI</p>
          {/* FAILED/diproses tampil "—", bukan 0 (BR-SCORE-04). */}
          <p className="text-score text-brand-primary">
            {evaluated ? formatScore(data.score) : '—'}
            {evaluated && <span className="text-h2 text-text-secondary"> / 100</span>}
          </p>
          {evaluated && <p className="text-h3 text-text-primary">{data.feedbackLabel}</p>}
          {failed && <p className="text-body text-text-secondary">Nilai belum tersedia.</p>}
        </div>
      </Card>
      {backLink}
    </div>
  );
}

/** ?jenis=tirukan membedakan percobaan Dengar-Tirukan dari Dengar-Pilih (keputusan proyek). */
export function AttemptDetailPage(): JSX.Element {
  const attemptId = useParams().attemptId ?? '';
  const [params] = useSearchParams();
  return params.get('jenis') === 'tirukan' ? <ImitationAttemptDetail submissionId={attemptId} /> : <QuizAttemptDetail attemptId={attemptId} />;
}
