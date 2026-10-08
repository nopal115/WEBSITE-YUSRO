// Tipe bersama lintas fitur (SDD Bab 5).
import type { PageMeta } from './responseFormat';

export type { PageMeta };

export type TaskType = 'QUIZ' | 'IMITATION';

/** SRS FR-FEEDBACK-02 / SDD 4.5.1 enum feedback_category. */
export type FeedbackCategory = 'SANGAT_BAIK' | 'BAIK' | 'CUKUP' | 'PERLU_LATIHAN';

/** SDD 3.11.2. */
export type EvaluationStatus = 'SUBMITTED' | 'PROCESSING' | 'EVALUATED' | 'FAILED';

export interface PageParams {
  page?: number;
  limit?: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta | null;
}

/** Menambahkan query ?page=&limit= bila diisi. */
export function withPage(path: string, params: PageParams = {}): string {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}
