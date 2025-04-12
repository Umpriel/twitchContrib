export interface Contribution {
  id: number;
  username: string;
  filename: string;
  line_number: number | null;
  code: string;
  status: string;
  created_at: string;
}

export interface User {
  id: string;
  username: string;
  is_channel_owner: boolean;
  access_token: string;
  refresh_token: string;
  token_expires_at: number;
  created_at: string;
}

export interface DatabaseAdapter {
  getContributions(): Promise<Contribution[]>;
  getContribution(id: number): Promise<Contribution | null>;
  updateStatus(id: number, status: string): Promise<void>;
  createContribution(username: string, filename: string, lineNumber: number | null, code: string): Promise<any>;
  checkSimilarContribution(username: string, filename: string, normalizedCode: string): Promise<boolean>;
  init(): Promise<void>;
  query(sql: string, params?: any[]): Promise<any[]>;
  createOrUpdateUser(user: Omit<User, 'created_at'>): Promise<User>;
  getUserByUsername(username: string): Promise<User | null>;
  getUserById(id: string): Promise<User | null>;
} 