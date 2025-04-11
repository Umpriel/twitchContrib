import { DatabaseAdapter } from './db-interface';

// Lazy-loaded adapter instance
let adapter: DatabaseAdapter | null = null;

// Get the appropriate adapter based on environment
const getAdapter = async (): Promise<DatabaseAdapter> => {
  if (adapter) return adapter;
  
  try {
    // Check if we're in Vercel environment
    if (process.env.VERCEL) {
      const { PostgresAdapter } = await import('./db-postgres');
      adapter = new PostgresAdapter();
    } else {
      const { SQLiteAdapter } = await import('./db-sqlite');
      adapter = new SQLiteAdapter();
    }
    
    // Initialize the database
    await adapter.init();
    return adapter;
  } catch (error) {
    console.error('Failed to initialize database adapter:', error);
    throw error;
  }
};

// Create a proxy object that will lazily initialize the correct adapter
const db: DatabaseAdapter = new Proxy({} as DatabaseAdapter, {
  get: (target, prop) => {
    return async (...args: any[]) => {
      const adapter = await getAdapter();
      const method = adapter[prop as keyof DatabaseAdapter];
      if (typeof method === 'function') {
        return (method as Function).apply(adapter, args);
      }
      return method;
    };
  }
});

export default db; 