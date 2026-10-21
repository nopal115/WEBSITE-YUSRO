// SDD 5.8 "Dashboard Santri" (GET /api/v1/dashboard).
export interface DashboardData {
  greeting: { name: string; studentCode: string };
  learningProgressPct: number;
  lastMaterial: { id: string; title: string; stageTitle: string } | null;
  unfinishedTasks: { id: string; title: string; type?: 'QUIZ' | 'IMITATION'; materialId?: string | null; materialTitle: string }[];
  /** Nilai percobaan terakhir, bukan nilai terbaik (SDD 3.14.4). */
  lastAttemptScore: { score: number; taskTitle: string; submittedAt: string } | null;
  materialsCompleted: number;
  tasksCompleted: number;
  continueTarget: { materialId: string } | null;

  /** Gamifikasi & Keistiqamahan Belajar */
  streak?: {
    days: number;
    activeToday: boolean;
  };
  dailyTarget?: {
    targetMaterials: number;
    completedMaterialsToday: number;
    targetTasks: number;
    completedTasksToday: number;
    isTargetMet: boolean;
  };
  completedStages?: {
    stageId: string;
    stageTitle: string;
    order: number;
  }[];
}
