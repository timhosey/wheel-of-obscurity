const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DB_PATH || path.join(dataDir, 'games.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    selected_at TEXT
  )
`);

// Migration: add selected_at if table existed from before (SQLite has no IF NOT EXISTS for columns)
try {
  db.exec(`ALTER TABLE games ADD COLUMN selected_at TEXT`);
} catch (_) {}

module.exports = db;
