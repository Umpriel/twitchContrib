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
  getContributionsByFilename(filename: string): Promise<Contribution[]>;
  updateStatus(id: number, status: string): Promise<void>;
  createContribution(
    username: string, 
    filename: string, 
    lineNumber: number | null, 
    code: string, 
    status?: string
  ): Promise<{ id: number | string }>;
  getSimilarContributions(
    username: string, 
    filename: string, 
    normalizedCode: string
  ): Promise<Contribution[]>;
  init(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
  createOrUpdateUser(user: Omit<User, 'created_at'>): Promise<User>;
  getUserByUsername(username: string): Promise<User | null>;
  getUserById(id: string): Promise<User | null>;
  checkContributionConflicts(
    filename: string,
    lineNumber: number | null,
    codeHash: string,
    username: string
  ): Promise<{ 
    personalDuplicate: boolean; 
    acceptedDuplicate: boolean; 
    lineConflict: boolean;
  }>;
} 