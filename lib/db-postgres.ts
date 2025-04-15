import { sql } from '@vercel/postgres';
import { DatabaseAdapter, Contribution, User, Settings } from './db-interface';

// Change let to const
const connectionPool: unknown = null;

export class PostgresAdapter implements DatabaseAdapter {
  async init(): Promise<void> {
    try {
      // Initialize the pool once
      if (!connectionPool && process.env.NEXT_PUBLIC_ENABLE_DB_MONITORING === 'true') {
        console.log('Initializing database connection pool');
        // The @vercel/postgres package handles pooling internally
      }
      
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
      
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          is_channel_owner BOOLEAN DEFAULT FALSE,
          access_token TEXT NOT NULL,
          refresh_token TEXT NOT NULL,
          token_expires_at BIGINT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
    } catch (error) {
      console.error('Failed to initialize Postgres tables:', error);
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

  async getContributionsByFilename(filename: string): Promise<Contribution[]> {
    try {
      const { rows } = await sql`SELECT * FROM contributions WHERE filename = ${filename}`;
      return rows as Contribution[];
    } catch (error) {
      console.error('Error fetching contributions by filename:', error);
      return [];
    }
  }

  async updateStatus(id: number, status: string): Promise<void> {
    try {
      await sql`UPDATE contributions SET status = ${status} WHERE id = ${id}`;
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }

  async createContribution(
    username: string, 
    filename: string, 
    lineNumber: number | null, 
    code: string,
    status: string = 'pending'
  ): Promise<{ id: number }> {
    try {
      // Simplified logging
      console.log('Creating contribution in database...');
      
      // Execute the query with optimized parameters
      const { rows } = await sql`
        INSERT INTO contributions (username, filename, line_number, code, status)
        VALUES (${username}, ${filename}, ${lineNumber}, ${code}, ${status})
        RETURNING id
      `;
      
      console.log('Contribution saved, ID:', rows[0]?.id);
      return { id: rows[0]?.id };
    } catch (error) {
      console.error('db-postgres.ts line 103, Database error:', error);
      throw error;
    }
  }

  async getSimilarContributions(username: string, filename: string, normalizedCode: string): Promise<Contribution[]> {
    try {
      // Use a smarter comparison that ensures operators are preserved
      const { rows } = await sql`
        SELECT * FROM contributions 
        WHERE username = ${username}
        AND filename = ${filename}
        AND REPLACE(REPLACE(REPLACE(code, E'\n', ' '), E'\r', ' '), '  ', ' ') ILIKE ${normalizedCode + '%'}
        AND created_at > NOW() - INTERVAL '1 hour'
        LIMIT 5
      `;
      return rows as Contribution[];
    } catch (error) {
      console.error('db-postgres.ts line 121 Error checking similar contributions:', error);
      return [];
    }
  }

  async query(sqlQuery: string, params?: unknown[]): Promise<unknown[]> {
    try {
      let pgSql = sqlQuery;
      if (params && params.length > 0) {
        let paramIndex = 0;
        pgSql = sqlQuery.replace(/\?/g, () => `$${++paramIndex}`);
      }
      
      const result = await sql.query(pgSql, params || []);
      return result.rows;
    } catch (error) {
      console.error('PostgreSQL query error:', error, { sql: sqlQuery });
      throw error;
    }
  }

  async createOrUpdateUser(user: Omit<User, 'created_at'>): Promise<User> {
    const result = await sql`
      INSERT INTO users (id, username, is_channel_owner, access_token, refresh_token, token_expires_at)
      VALUES (${user.id}, ${user.username}, ${user.is_channel_owner}, ${user.access_token}, ${user.refresh_token}, ${user.token_expires_at})
      ON CONFLICT (id) DO UPDATE SET
        username = ${user.username},
        is_channel_owner = ${user.is_channel_owner},
        access_token = ${user.access_token},
        refresh_token = ${user.refresh_token},
        token_expires_at = ${user.token_expires_at}
      RETURNING *;
    `;
    
    return result.rows[0] as User;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const result = await sql`SELECT * FROM users WHERE username = ${username}`;
    return result.rows.length > 0 ? (result.rows[0] as User) : null;
  }

  async getUserById(id: string): Promise<User | null> {
    const result = await sql`SELECT * FROM users WHERE id = ${id}`;
    return result.rows.length > 0 ? (result.rows[0] as User) : null;
  }

  async checkContributionConflicts(
    filename: string,
    lineNumber: number | null,
    codeHash: string,
    username: string
  ): Promise<{ personalDuplicate: boolean; acceptedDuplicate: boolean; lineConflict: boolean }> {
    try {
      const { rows } = await sql`
        WITH normalized_contributions AS (
          SELECT 
            id,
            username,
            filename,
            line_number,
            status,
            REPLACE(REPLACE(REPLACE(LOWER(code), E'\n', ''), ' ', ''), E'\r', '') || filename as normalized_code
          FROM contributions
          WHERE filename = ${filename}
        )
        SELECT
          COUNT(CASE WHEN normalized_code = ${codeHash} AND username = ${username} THEN 1 END) > 0 as personal_duplicate,
          COUNT(CASE WHEN normalized_code = ${codeHash} AND status = 'accepted' THEN 1 END) > 0 as accepted_duplicate,
          COUNT(CASE WHEN line_number = ${lineNumber} AND ${lineNumber} IS NOT NULL 
                    AND username != ${username} AND status = 'pending' THEN 1 END) > 0 as line_conflict
        FROM normalized_contributions
      `;
      
      return {
        personalDuplicate: rows[0]?.personal_duplicate || false,
        acceptedDuplicate: rows[0]?.accepted_duplicate || false,
        lineConflict: rows[0]?.line_conflict || false
      };
    } catch (error) {
      console.error('Error checking contribution conflicts:', error);
      return { personalDuplicate: false, acceptedDuplicate: false, lineConflict: false };
    }
  }

  async updateContribution(id: number, data: Partial<Contribution>): Promise<void> {
    try {
      // Convert the data object to a set of fields for SQL update
      const updateFields = Object.entries(data)
        .map(([key], index) => `${key} = $${index + 1}`)
        .join(', ');
      
      // Extract values in the same order as the fields
      const values = Object.values(data);
      
      // Execute the update query with raw SQL
      await sql.query(
        `UPDATE contributions SET ${updateFields} WHERE id = $${values.length + 1}`,
        [...values, id]
      );
    } catch (error) {
      console.error('Error updating contribution:', error);
      throw error;
    }
  }

  async getUserContributions(username: string, limit: number): Promise<Contribution[]> {
    try {
      const { rows } = await sql`
        SELECT * FROM contributions 
        WHERE username = ${username}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
      return rows as Contribution[];
    } catch (error) {
      console.error('Error fetching user contributions:', error);
      return [];
    }
  }

  async getFileContributions(filename: string, limit: number): Promise<Contribution[]> {
    try {
      const { rows } = await sql`
        SELECT * FROM contributions 
        WHERE filename = ${filename}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
      return rows as Contribution[];
    } catch (error) {
      console.error('Error fetching file contributions:', error);
      return [];
    }
  }

  async deleteContribution(id: number): Promise<void> {
    try {
      await sql`DELETE FROM contributions WHERE id = ${id}`;
    } catch (error) {
      console.error('Error deleting contribution:', error);
      throw error;
    }
  }

  async getUserByChannelName(channelName: string): Promise<User | null> {
    const results = await this.query(
      'SELECT * FROM users WHERE username = $1 AND is_channel_owner = true',
      [channelName.toLowerCase()]
    ) as any[];
    return results && results.length > 0 ? results[0] as User : null;
  };

  async getSettings(): Promise<Settings | null> {
    try {
      // Ensure settings table exists
      await this.query(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          data JSONB
        )
      `);
      
      const result = await this.query(
        'SELECT data FROM settings WHERE key = $1',
        ['app_settings']
      );
      
      if (result && result.length > 0) {
        return (result[0] as any).data as Settings;
      }
      
      // Create default settings if none exist
      const defaultSettings: Settings = {
        welcomeMessage: 'Bot connected and authenticated successfully!',
        showRejected: true,
        useHuhMode: false
      };
      
      // Save default settings
      await this.query(
        'INSERT INTO settings (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
        ['app_settings', defaultSettings]
      );
      
      return defaultSettings;
    } catch (error) {
      console.error('Error getting settings from database:', error);
      return null;
    }
  }

  async updateSettings(settings: Settings): Promise<boolean> {
    try {
      await this.query(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          data JSONB
        )
      `);
      
      await this.query(
        'INSERT INTO settings (key, data) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET data = $2',
        ['app_settings', settings]
      );
      
      return true;
    } catch (error) {
      console.error('Error updating settings in database:', error);
      return false;
    }
  }
} 