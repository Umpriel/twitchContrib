import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(process.cwd(), 'contributions.db'));

// Initialize database
db.exec(`
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

export default db; 