export interface SubtaskConfig {
  id: string;
  question: string;
  yes_action: 'complete' | 'create_subtasks';
  yes_subtasks: SubtaskConfig[];
  no_action: 'complete' | 'create_subtasks';
  no_subtasks: SubtaskConfig[];
}

export interface Job {
  id: string;
  name: string;
  description: string;
  tasks: SubtaskConfig[];
  created_at: string;
  updated_at: string;
}

export interface AnswerRecord {
  task_id: string;
  question: string;
  answer: 'ja' | 'nei';
  answered_at: string;
  level: number;
  parent_id: string | null;
}

export interface Session {
  id: string;
  job_id: string;
  job_name: string;
  started_at: string;
  completed_at: string | null;
  answers: AnswerRecord[];
  status: 'in_progress' | 'completed';
}

// Flat task item used during session execution
export interface ExecutionTask {
  config: SubtaskConfig;
  level: number;
  parent_id: string | null;
}
