export type TaskType = 'QUIZ' | 'IMITATION';
export type ContentStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

export interface AnswerOptionItem {
  id?: string;
  text: string;
  label?: string;
  isCorrect: boolean;
}

export interface QuestionItem {
  id: string;
  prompt: string;
  order: number;
  audioId?: string | null;
  audioName?: string | null;
  options: AnswerOptionItem[];
}

export interface AdminTaskListItem {
  id: string;
  title: string;
  type: TaskType;
  status: ContentStatus;
  order: number;
  orderIndex?: number;
  stageId: string;
  stageTitle: string;
  materialId?: string | null;
  materialTitle?: string | null;
  referenceAudioId?: string | null;
  questionCount: number;
  isReferenced: boolean;
}

export interface AdminTaskDetail {
  id: string;
  title: string;
  type: TaskType;
  status: ContentStatus;
  order: number;
  stageId: string;
  stageTitle: string;
  materialId?: string | null;
  materialTitle?: string | null;
  referenceAudioId?: string | null;
  referenceAudio?: {
    id: string;
    originalName: string;
    durationSeconds?: number;
    durationMs?: number;
  } | null;
  questionCount: number;
  questions: QuestionItem[];
}

export interface TaskInput {
  title: string;
  type: TaskType;
  stageId: string;
  materialId?: string | null;
  order: number;
  status?: ContentStatus;
  referenceAudioId?: string | null;
}

export interface QuestionInput {
  prompt: string;
  order?: number;
  audioId?: string | null;
  options: {
    id?: string;
    text: string;
    isCorrect: boolean;
  }[];
}
