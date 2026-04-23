import { Database } from "bun:sqlite";
import path from "node:path";

/** Single shared SQLite handle. WAL mode for reasonable concurrency. */
const DB_PATH = process.env.DB_PATH ?? path.join(import.meta.dir, "..", "data.db");

export const db = new Database(DB_PATH, { create: true });
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA synchronous = NORMAL;");

/** Typed row of the generic records table. */
export interface RecordRow {
  resource: string;
  id: string;
  data: string;
  created_at: string;
  updated_at: string;
}

export function nowIso(): string {
  return new Date().toISOString();
}
