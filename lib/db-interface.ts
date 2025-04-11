export interface Contribution {
  id: number;
  username: string;
  filename: string;
  line_number: number | null;
  code: string;
  status: string;
  created_at: string;
}

export interface DatabaseAdapter {
  getContributions(): Promise<Contribution[]>;
  getContribution(id: number): Promise<Contribution | null>;
  updateStatus(id: number, status: string): Promise<void>;
  createContribution(username: string, filename: string, lineNumber: number | null, code: string): Promise<any>;
  checkSimilarContribution(username: string, filename: string, normalizedCode: string): Promise<boolean>;
  init(): Promise<void>;
} 