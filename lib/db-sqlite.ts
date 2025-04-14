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

  async getContributionsByFilename(filename: string): Promise<Contribution[]> {
    return this.db.prepare('SELECT * FROM contributions WHERE filename = ?').all(filename) as Contribution[];
  }

  async updateStatus(id: number, status: string): Promise<void> {
    const stmt = this.db.prepare('UPDATE contributions SET status = ? WHERE id = ?');
    stmt.run(status, id);
  }

  async createContribution(username: string, filename: string, lineNumber: number | null, code: string, status: string = 'pending'): Promise<{ id: number | string }> {
    const stmt = this.db.prepare(
      'INSERT INTO contributions (username, filename, line_number, code, status) VALUES (?, ?, ?, ?, ?)'
    );
    const result = stmt.run(username, filename, lineNumber, code, status);
    return { id: Number(result.lastInsertRowid) };
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

  async getSimilarContributions(username: string, filename: string, normalizedCode: string): Promise<Contribution[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM contributions 
        WHERE username = ? 
        AND filename = ? 
        AND REPLACE(REPLACE(code, '\n', ' '), '  ', ' ') LIKE ?
        AND datetime(created_at) > datetime('now', '-1 hour')
        LIMIT 5
      `);
      return stmt.all(username, filename, normalizedCode + '%') as Contribution[];
    } catch (error) {
      console.error('Error checking similar contributions:', error);
      return [];
    }
  }

  async query(sql: string, params?: unknown[]): Promise<unknown[]> {
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

  async checkContributionConflicts(
    filename: string,
    lineNumber: number | null,
    codeHash: string,
    username: string
  ): Promise<{ personalDuplicate: boolean; acceptedDuplicate: boolean; lineConflict: boolean }> {
    try {
      // Personal duplicate check
      const personalDupeStmt = this.db.prepare(`
        SELECT COUNT(*) as count
        FROM contributions
        WHERE filename = ? 
        AND REPLACE(REPLACE(REPLACE(LOWER(code), '\n', ''), ' ', ''), '\r', '') || filename = ?
        AND username = ?
      `);
      const personalResult = personalDupeStmt.get(filename, codeHash, username) as { count: number };
      
      // Accepted duplicate check
      const acceptedDupeStmt = this.db.prepare(`
        SELECT COUNT(*) as count
        FROM contributions
        WHERE filename = ? 
        AND REPLACE(REPLACE(REPLACE(LOWER(code), '\n', ''), ' ', ''), '\r', '') || filename = ?
        AND status = 'accepted'
      `);
      const acceptedResult = acceptedDupeStmt.get(filename, codeHash) as { count: number };
      
      // Line conflict check
      const lineConflictStmt = this.db.prepare(`
        SELECT COUNT(*) as count
        FROM contributions
        WHERE filename = ? 
        AND line_number = ? 
        AND ? IS NOT NULL
        AND username != ?
        AND status = 'pending'
      `);
      const lineResult = lineConflictStmt.get(filename, lineNumber, lineNumber, username) as { count: number };
      
      return {
        personalDuplicate: personalResult.count > 0,
        acceptedDuplicate: acceptedResult.count > 0,
        lineConflict: lineResult.count > 0
      };
    } catch (error) {
      console.error('Error checking contribution conflicts:', error);
      return { personalDuplicate: false, acceptedDuplicate: false, lineConflict: false };
    }
  }

  async updateContribution(id: number, data: Partial<Contribution>): Promise<void> {
    const updateFields = Object.keys(data)
      .map(field => `${field} = ?`)
      .join(', ');
    
    const values = [...Object.values(data), id];
    
    const stmt = this.db.prepare(
      `UPDATE contributions SET ${updateFields} WHERE id = ?`
    );
    stmt.run(...values);
  }

  async getUserContributions(username: string, limit: number): Promise<Contribution[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM contributions 
        WHERE username = ? 
        ORDER BY created_at DESC
        LIMIT ?
      `);
      return stmt.all(username, limit) as Contribution[];
    } catch (error) {
      console.error('Error fetching user contributions:', error);
      return [];
    }
  }

  async getFileContributions(filename: string, limit: number): Promise<Contribution[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM contributions 
        WHERE filename = ? 
        ORDER BY created_at DESC
        LIMIT ?
      `);
      return stmt.all(filename, limit) as Contribution[];
    } catch (error) {
      console.error('Error fetching file contributions:', error);
      return [];
    }
  }

  async deleteContribution(id: number): Promise<void> {
    try {
      const stmt = this.db.prepare('DELETE FROM contributions WHERE id = ?');
      stmt.run(id);
    } catch (error) {
      console.error('Error deleting contribution:', error);
      throw error;
    }
  }

  async getUserByChannelName(channelName: string): Promise<User | null> {
    const results = await this.query(
      'SELECT * FROM users WHERE username = ? AND is_channel_owner = 1',
      [channelName.toLowerCase()]
    ) as any[];
    return results && results.length > 0 ? results[0] as User : null;
  }
} 