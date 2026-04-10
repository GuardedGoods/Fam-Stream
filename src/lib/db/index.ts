import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

let _db: BetterSQLite3Database<typeof schema> | null = null;

function getDbPath(): string {
  return (
    process.env.DATABASE_URL?.replace("file:", "") ||
    path.join(process.cwd(), "data", "fam-stream.db")
  );
}

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (!_db) {
    const dbPath = getDbPath();

    // Ensure data directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("busy_timeout = 5000");

    _db = drizzle(sqlite, { schema });
  }
  return _db;
}

// For convenience - but note this eagerly creates the connection
// Use getDb() in contexts where you need lazy initialization
export const db = getDb();

export type DB = BetterSQLite3Database<typeof schema>;
