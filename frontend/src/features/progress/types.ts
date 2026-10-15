import type { EvaluationStatus, TaskType } from '../../lib/api/types';
import type { StageAccess } from '../learning/types';

// SDD 5.11. Tiga ukuran progress dikirim terpisah dan tidak boleh tertukar (BR-PROGRESS-01/02).
export interface ProgressRatio {
  completed: number;
  total: number;
  pct: number;
}

export interface Progress {
  learningProgressPct: number;
  materials: ProgressRatio;
  tasks: ProgressRatio;
  stages: { id: string; title: string; access: StageAccess; pct: number }[];
}

export interface HistoryItem {
  attemptId: string;
  taskId: string;
  taskTitle: string;
  materialTitle: string;
  taskType: TaskType;
  attemptNo: number;
  /** null untuk percobaan FAILED (BR-SCORE-04). */
  score: number | null;
  /** null untuk Dengar-Pilih. */
  evaluationStatus: EvaluationStatus | null;
  displayStatus: string;
  submittedAt: string;
}
