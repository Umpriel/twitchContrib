import { sql } from '@vercel/postgres';
import { DatabaseAdapter, Contribution } from './db-interface';

export class PostgresAdapter implements DatabaseAdapter {
  async init(): Promise<void> {
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS contributions (
          id SERIAL PRIMARY KEY,
          username TEXT NOT NULL,
          filename TEXT NOT NULL,
          line_number INTEGER NULL,
          code TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
    } catch (error) {
      console.error('Failed to initialize Postgres table:', error);
    }
  }

  async getContributions(): Promise<Contribution[]> {
    try {
      const { rows } = await sql`SELECT * FROM contributions ORDER BY created_at DESC`;
      return rows as Contribution[];
    } catch (error) {
      console.error('Error fetching contributions:', error);
      return [];
    }
  }

  async getContribution(id: number): Promise<Contribution | null> {
    try {
      const { rows } = await sql`SELECT * FROM contributions WHERE id = ${id}`;
      return rows.length > 0 ? (rows[0] as Contribution) : null;
    } catch (error) {
      console.error('Error fetching contribution:', error);
      return null;
    }
  }

  async updateStatus(id: number, status: string): Promise<void> {
    try {
      await sql`UPDATE contributions SET status = ${status} WHERE id = ${id}`;
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }

  async createContribution(username: string, filename: string, lineNumber: number | null, code: string): Promise<any> {
    try {
      const { rows } = await sql`
        INSERT INTO contributions (username, filename, line_number, code)
        VALUES (${username}, ${filename}, ${lineNumber}, ${code})
        RETURNING id
      `;
      return rows[0];
    } catch (error) {
      console.error('Error creating contribution:', error);
      return null;
    }
  }

  async checkSimilarContribution(username: string, filename: string, normalizedCode: string): Promise<boolean> {
    try {
      const { rows } = await sql`
        SELECT * FROM contributions 
        WHERE username = ${username}
        AND filename = ${filename}
        AND REPLACE(REPLACE(code, E'\n', ' '), '  ', ' ') = ${normalizedCode}
        AND created_at > NOW() - INTERVAL '1 hour'
      `;
      return rows.length > 0;
    } catch (error) {
      console.error('Error checking similar contributions:', error);
      return false;
    }
  }

  async query(sqlStatement: string, params?: any[]): Promise<any[]> {
    try {
      let pgSql = sqlStatement;
      if (params && params.length > 0) {
        let paramIndex = 0;
        pgSql = sqlStatement.replace(/\?/g, () => `$${++paramIndex}`);
      }
      
      const result = await sql.query(pgSql, params || []);
      return result.rows;
    } catch (error) {
      console.error('PostgreSQL query error:', error, { sql: sqlStatement });
      throw error;
    }
  }
} 