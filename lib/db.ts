import { DatabaseAdapter } from './db-interface';
import { AccessToken } from '@twurple/auth';
import { sql } from '@vercel/postgres';


let adapter: DatabaseAdapter | null = null;


const getAdapter = async (): Promise<DatabaseAdapter> => {
  if (adapter) return adapter;
  
  try {

    if (process.env.VERCEL) {
      const { PostgresAdapter } = await import('./db-postgres');
      adapter = new PostgresAdapter();
    } else {
      const { SQLiteAdapter } = await import('./db-sqlite');
      adapter = new SQLiteAdapter();
    }
    

    await adapter.init();
    return adapter;
  } catch (error) {
    console.error('Failed to initialize database adapter:', error);
    throw error;
  }
};


const db: DatabaseAdapter = new Proxy({} as DatabaseAdapter, {
  get: (target, prop) => {
    return async (...args: unknown[]) => {
      const adapter = await getAdapter();
      const method = adapter[prop as keyof DatabaseAdapter];
      if (typeof method === 'function') {
        return (method as (...methodArgs: unknown[]) => unknown).apply(adapter, args);
      }
      return method;
    };
  }
});

export default db;


export async function getTwitchToken() {
  try {
    const adapter = await getAdapter();
    const result = await adapter.query(
      'SELECT data FROM settings WHERE key = ?',
      ['twitch_token']
    );
    
    if (result && result.length > 0) {
      const firstResult = result[0] as { data: string };
      return JSON.parse(firstResult.data);
    }
    return undefined;
  } catch (error) {
    console.error('Error getting token from database:', error);
    return undefined;
  }
}


export async function saveTwitchToken(tokenData: AccessToken) {
  try {
    const adapter = await getAdapter();
    

    await adapter.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        data TEXT
      )
    `);
    

    const exists = await adapter.query(
      'SELECT 1 FROM settings WHERE key = ?', 
      ['twitch_token']
    );
    
    if (exists && exists.length > 0) {

      await adapter.query(
        'UPDATE settings SET data = ? WHERE key = ?',
        [JSON.stringify(tokenData), 'twitch_token']
      );
    } else {

      await adapter.query(
        'INSERT INTO settings (key, data) VALUES (?, ?)',
        ['twitch_token', JSON.stringify(tokenData)]
      );
    }
    return true;
  } catch (error) {
    console.error('Error saving token to database:', error);
    return false;
  }
}


export async function getUserByChannelOwner() {

  const [user] = await db.query('SELECT * FROM users WHERE is_channel_owner = true LIMIT 1');
  return user;
}

// Add Neon DB specific optimizations

// Add health check function
export async function checkDatabaseHealth() {
  try {
    const startTime = Date.now();
    const { rows } = await sql`SELECT 1 as health_check`;
    const duration = Date.now() - startTime;
    
    console.log(`[DB Health] Connection test completed in ${duration}ms`);
    return {
      healthy: rows.length > 0 && rows[0].health_check === 1,
      latency: duration
    };
  } catch (error) {
    console.error('[DB Health] Connection test failed:', error);
    return {
      healthy: false,
      latency: -1,
      error: (error as Error).message
    };
  }
}

// Call this periodically
setInterval(async () => {
  const health = await checkDatabaseHealth();
  if (!health.healthy) {
    console.error('[DB Alert] Database connection issues detected');
  } else if (health.latency > 500) {
    console.warn(`[DB Alert] High database latency: ${health.latency}ms`);
  }
}, 60000); // Check every minute 