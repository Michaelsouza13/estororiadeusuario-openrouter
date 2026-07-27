
export interface CriteriaScore {
  persona: number;
  action: number;
  structure: number;
}

export interface AnalysisResult {
  id?: string; // ID da tarefa (JIRA, Trello, etc ou Hash)
  owner?: string; // Nome do Agilista/Responsável
  date?: string; // Data da análise
  quarter?: string; // Trimestre (ex: 2024-Q1)
  originalStory: string;
  totalScore: number;
  criteriaScores: CriteriaScore;
  feedback: string;
  improvedVersion: string;
  isDuplicate?: boolean; // Flag para identificar se veio do histórico
  isReference?: boolean; // Flag para identificar se é um exemplo de ouro (Golden Sample)
  uncertaintyNote?: string; // Mensagem da IA caso tenha dúvida sobre algum termo ou contexto
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface BulkUploadStats {
  total: number;
  averageScore: number;
  processed: number;
  skipped: number;
}

export interface FileRow {
  id: string;
  story: string;
  owner: string;
}
