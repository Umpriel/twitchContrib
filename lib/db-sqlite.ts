import Database from 'better-sqlite3';
import path from 'path';
import { DatabaseAdapter, Contribution, User } from './db-interface';

export class SQLiteAdapter implements DatabaseAdapter {
  private db: Database.Database;

  constructor() {
    this.db = new Database(path.join(process.cwd(), 'contributions.db'));
    this.init();
  }

  async init(): Promise<void> {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS contributions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL,
          filename TEXT NOT NULL,
          line_number INTEGER,
          code TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          is_channel_owner BOOLEAN DEFAULT 0,
          access_token TEXT NOT NULL,
          refresh_token TEXT NOT NULL,
          token_expires_at INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (error) {
      console.error('Failed to initialize SQLite tables:', error);
    }
  }

  async getContributions(): Promise<Contribution[]> {
    return this.db.prepare('SELECT * FROM contributions ORDER BY created_at DESC').all() as Contribution[];
  }

  async getContribution(id: number): Promise<Contribution | null> {
    return this.db.prepare('SELECT * FROM contributions WHERE id = ?').get(id) as Contribution | null;
  }

  async updateStatus(id: number, status: string): Promise<void> {
    const stmt = this.db.prepare('UPDATE contributions SET status = ? WHERE id = ?');
    stmt.run(status, id);
  }

  async createContribution(username: string, filename: string, lineNumber: number | null, code: string): Promise<any> {
    const stmt = this.db.prepare(
      'INSERT INTO contributions (username, filename, line_number, code) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(username, filename, lineNumber, code);
    return { id: result.lastInsertRowid };
  }

  async checkSimilarContribution(username: string, filename: string, normalizedCode: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      SELECT * FROM contributions 
      WHERE username = ? 
      AND filename = ? 
      AND REPLACE(REPLACE(code, '\n', ' '), '  ', ' ') = ?
      AND datetime(created_at) > datetime('now', '-1 hour')
    `);
    const existing = stmt.get(username, filename, normalizedCode);
    return !!existing;
  }

  async query(sql: string, params?: any[]): Promise<any[]> {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...(params || []));
    } catch (error) {
      console.error('SQLite query error:', error);
      throw error;
    }
  }

  async createOrUpdateUser(user: Omit<User, 'created_at'>): Promise<User> {
    const stmt = this.db.prepare(`
      INSERT INTO users (id, username, is_channel_owner, access_token, refresh_token, token_expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username,
        is_channel_owner = excluded.is_channel_owner,
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        token_expires_at = excluded.token_expires_at
    `);
    
    stmt.run(
      user.id,
      user.username,
      user.is_channel_owner ? 1 : 0,
      user.access_token,
      user.refresh_token,
      user.token_expires_at
    );
    
    return this.getUserById(user.id) as Promise<User>;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | null;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | null;
  }
} 