import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";
import path from "path";
import { mkdirSync } from "fs";

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "livestock.db");

mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new DatabaseSync(dbPath);
sqlite.exec("PRAGMA journal_mode = WAL");
sqlite.exec("PRAGMA foreign_keys = ON");

export function initDb(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS animals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      species TEXT NOT NULL,
      sex TEXT NOT NULL,
      farm TEXT,
      birth_date TEXT,
      notes TEXT,
      sire_id INTEGER REFERENCES animals(id) ON DELETE SET NULL,
      dam_id INTEGER REFERENCES animals(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS inbreeding_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sire_id INTEGER NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
      dam_id INTEGER NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
      f_coefficient REAL NOT NULL,
      risk_level TEXT NOT NULL,
      calculated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);
}

export const db = drizzle(
  async (sql, params, method) => {
    const stmt = sqlite.prepare(sql);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = params as any[];
    if (method === "run") {
      stmt.run(...p);
      return { rows: [] };
    }
    const raw = method === "get" ? stmt.get(...p) : stmt.all(...p);
    const rowArray = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return { rows: (rowArray as Record<string, unknown>[]).map((r) => Object.values(r)) };
  },
  { schema },
);

export * from "./schema";
