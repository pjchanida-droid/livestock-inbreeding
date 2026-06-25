---
name: SQLite via node:sqlite
description: How SQLite is implemented in this project — uses Node.js 24 built-in node:sqlite with drizzle-orm/sqlite-proxy instead of better-sqlite3.
---

## Rule
Use `node:sqlite` (Node.js 24 built-in) + `drizzle-orm/sqlite-proxy` for the database layer. Do NOT attempt to install `better-sqlite3` — it requires Python/node-gyp which is unavailable on Replit NixOS.

**Why:** `better-sqlite3` is a native module that needs Python 3 and C++ build tools to compile. The Replit NixOS environment does not have Python in PATH. Node.js 24 has built-in SQLite (`DatabaseSync` from `node:sqlite`) that requires zero compilation.

**How to apply:**
- `lib/db/src/index.ts` uses `DatabaseSync` from `node:sqlite` for raw operations (initDb, PRAGMA)
- `drizzle-orm/sqlite-proxy` wraps it with an async callback: convert `stmt.all()`/`stmt.get()` results (row objects) to arrays of values via `Object.values(r)`
- `initDb()` is synchronous and must be called at server startup (in `app.ts`) before any routes are registered
- Schema uses `drizzle-orm/sqlite-core`: `sqliteTable`, `integer(...).primaryKey({ autoIncrement: true })`, `text(...)` for all date/timestamp columns
- Date values are stored as ISO strings; routes must NOT call `.toISOString()` on them — they are already strings
- SQLite UNIQUE constraint errors: check `String(err?.message).includes("UNIQUE")` not `err?.code === "23505"` (PostgreSQL-specific)
- DB file location: `process.env.DATABASE_PATH` or default `./data/livestock.db` relative to process CWD
- `drizzle-orm/sqlite-proxy` returns an async database; all Drizzle queries return Promises (fine for Express routes)
