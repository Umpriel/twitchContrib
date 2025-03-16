import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';

export const initializeDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database('database.sqlite');

    db.serialize(() => {
      // Create users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE,
          accepted_contributions INTEGER DEFAULT 0,
          rejected_contributions INTEGER DEFAULT 0
        )
      `);

      // Create contributions table
      db.run(`
        CREATE TABLE IF NOT EXISTS contributions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          filename TEXT,
          line_number INTEGER,
          character_number INTEGER,
          code TEXT,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

export const getDb = (): Database => {
  return new sqlite3.Database('database.sqlite');
}; 