import Database from 'better-sqlite3';
import path from 'path';
import { DatabaseAdapter, Contribution } from './db-interface';

export class SQLiteAdapter implements DatabaseAdapter {
  private db: Database.Database;

  constructor() {
    this.db = new Database(path.join(process.cwd(), 'contributions.db'));
    this.init();
  }

  async init(): Promise<void> {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contributions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        filename TEXT NOT NULL,
        line_number INTEGER NULL,
        code TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
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
} 