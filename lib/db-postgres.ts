import { sql } from '@vercel/postgres';
import { DatabaseAdapter, Contribution, User } from './db-interface';

// Add connection monitoring
let queryCount = 0;
let lastResetTime = Date.now();
const METRICS_INTERVAL = 60000; // Log metrics every minute

// Reset metrics periodically
setInterval(() => {
  console.log(`DB Performance: ${queryCount} queries in the last ${(Date.now() - lastResetTime)/1000}s`);
  queryCount = 0;
  lastResetTime = Date.now();
}, METRICS_INTERVAL);

// Change let to const
const connectionPool: unknown = null;

// Add transaction support to prevent race conditions
async function withTransaction<T>(operation: () => Promise<T>): Promise<T> {
  try {
    await sql`BEGIN`;
    const result = await operation();
    await sql`COMMIT`;
    return result;
  } catch (error) {
    await sql`ROLLBACK`;
    console.error('Transaction failed:', error);
    throw error;
  }
}

// Use transactions for critical operations
async function updateMultipleStatuses(contributionIds: number[], status: string): Promise<void> {
  return withTransaction(async () => {
    for (const id of contributionIds) {
      await sql`UPDATE contributions SET status = ${status} WHERE id = ${id}`;
    }
  });
}

export class PostgresAdapter implements DatabaseAdapter {
  async init(): Promise<void> {
    try {
      // Initialize the pool once
      if (!connectionPool) {
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
    const startTime = Date.now();
    try {
      // Add limit and optimize query
      const { rows } = await sql`
        SELECT * FROM contributions 
        ORDER BY created_at DESC 
        LIMIT 100
      `;
      
      queryCount++;
      console.log(`[DB] Fetched ${rows.length} contributions in ${Date.now() - startTime}ms`);
      return rows as Contribution[];
    } catch (error) {
      console.error('[DB] Error fetching contributions:', error);
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

  async createContribution(
    username: string, 
    filename: string, 
    lineNumber: number | null, 
    code: string,
    status: string = 'pending'
  ): Promise<{ id: number }> {
    try {
      const startTime = Date.now();
      console.log(`[DB] Starting contribution creation for ${username}`);
      
      // Execute the query with optimized parameters
      const { rows } = await sql`
        INSERT INTO contributions (username, filename, line_number, code, status)
        VALUES (${username}, ${filename}, ${lineNumber}, ${code}, ${status})
        RETURNING id
      `;
      
      queryCount++;
      const duration = Date.now() - startTime;
      console.log(`[DB] Contribution saved, ID: ${rows[0]?.id}, took ${duration}ms`);
      
      // Add warning for slow queries
      if (duration > 500) {
        console.warn(`[DB] Slow query detected: createContribution by ${username} took ${duration}ms`);
      }
      
      return { id: rows[0]?.id };
    } catch (error) {
      console.error('[DB] Error creating contribution:', error);
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
      console.error('Error checking similar contributions:', error);
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
} 