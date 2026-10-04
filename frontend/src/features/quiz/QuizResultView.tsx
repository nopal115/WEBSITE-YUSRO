import { CheckCircle2, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '../../components/ui/Card';
import { formatScore } from '../dashboard/view';
import { FEEDBACK_LABEL, mapResults } from './session';
import type { QuizOption, QuizQuestionSnapshot, QuizSubmitResult } from './types';

export function ArabicOption({ option }: { option: QuizOption | undefined }): JSX.Element {
  if (!option) return <span>—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-arabic text-arabic-s text-text-primary" lang="ar" dir="rtl">
        {option.arabicLabel}
      </span>
      <span>{option.label}</span>
    </span>
  );
}

interface QuizResultViewProps {
  result: Pick<QuizSubmitResult, 'score' | 'feedbackCategory' | 'correctCount' | 'questionCount' | 'results'>;
  questions: QuizQuestionSnapshot[];
  /** Tombol/tautan aksi dari pemanggil (mis. KERJAKAN LAGI di layar latihan, tautan kembali di riwayat). */
  actions: ReactNode;
}

/**
 * Hasil Dengar-Pilih (SDD 7.7.9, SRS UI-QUIZ-02): status, nilai /100, kategori dari server,
 * jumlah benar, dan rincian per soal dengan kunci jawaban. Dipakai layar latihan dan detail riwayat.
 */
export function QuizResultView({ result, questions, actions }: QuizResultViewProps): JSX.Element {
  const rows = mapResults(questions, result);
  return (
    <>
      <Card>
        <p className="flex items-center gap-2 text-h3 text-feedback-benar">
          <CheckCircle2 size={24} aria-hidden="true" />
          Tugas selesai
        </p>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <p className="text-score text-brand-primary">
            {formatScore(result.score)}
            <span className="text-h2 text-text-secondary"> / 100</span>
          </p>
          {/* Kategori dari server, ditampilkan sebagai label netral. */}
          <p className="text-h3 text-text-primary">{FEEDBACK_LABEL[result.feedbackCategory]}</p>
        </div>
        <p className="mt-2 text-body text-text-secondary">
          Jawaban benar {result.correctCount} / {result.questionCount}
        </p>
      </Card>

      <section aria-labelledby="rincian-jawaban" className="flex flex-col gap-3">
        <h2 id="rincian-jawaban" className="text-h3">
          Rincian jawaban
        </h2>
        <ol className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.questionId} className="rounded-md border border-neutral-border bg-neutral-surface p-5">
              <div className="flex items-start justify-between gap-4">
                <p className="text-body font-semibold">
                  Soal {row.number} — {row.prompt}
                </p>
                {/* Benar/salah dengan ikon + teks, bukan warna saja (SDD 7.3). */}
                <span className={`flex shrink-0 items-center gap-1 text-body-s font-semibold ${row.isCorrect ? 'text-feedback-benar' : 'text-feedback-salah'}`}>
                  {row.isCorrect ? <CheckCircle2 size={18} aria-hidden="true" /> : <XCircle size={18} aria-hidden="true" />}
                  {row.isCorrect ? 'Benar' : 'Salah'}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 text-body-s text-text-secondary">
                <dt>Jawaban Anda</dt>
                <dd className="text-text-primary">
                  <ArabicOption option={row.selected} />
                </dd>
                <dt>Kunci jawaban</dt>
                <dd className="text-text-primary">
                  <ArabicOption option={row.correct} />
                </dd>
              </dl>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">{actions}</div>
    </>
  );
}
