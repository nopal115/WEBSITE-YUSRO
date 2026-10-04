import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { formatDateTime } from '../../lib/utils/format';
import { ErrorState, ListSkeleton } from '../learning/QueryStates';
import { quizApi } from '../quiz/api';
import { QuizResultView } from '../quiz/QuizResultView';

const backLink = (
  <Link to="/riwayat" className="flex min-h-11 items-center gap-2 self-start text-body text-brand-primary hover:underline">
    <ArrowLeft size={20} aria-hidden="true" />
    Kembali ke riwayat
  </Link>
);

// Detail percobaan Dengar-Pilih dari riwayat (GET /quiz/attempts/:id). Tanpa KERJAKAN LAGI.
export function AttemptDetailPage(): JSX.Element {
  const attemptId = useParams().attemptId ?? '';
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['progress', 'attempt', attemptId],
    queryFn: ({ signal }) => quizApi.getAttempt(attemptId, signal),
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-[1040px]">
        <ListSkeleton rows={3} />
      </div>
    );
  }
  if (isError) {
    // 404: tidak ditemukan atau bukan milik santri (SDD 6.4.4); tanpa COBA LAGI.
    return (
      <div className="mx-auto max-w-[1040px]">
        <ErrorState error={error} onRetry={() => void refetch()} backTo="/riwayat" backLabel="Kembali ke riwayat" />
      </div>
    );
  }

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
