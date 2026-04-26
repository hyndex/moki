import { Database } from "bun:sqlite";
import path from "node:path";

/** Single shared SQLite handle. Production-grade PRAGMAs:
 *
 *    journal_mode=WAL    readers don't block writers; writers don't
 *                        block readers (most concurrent profile).
 *    foreign_keys=ON     enforce FK constraints at write time.
 *    synchronous=NORMAL  fsync at WAL checkpoint, not every commit —
 *                        durable across crashes, ~5× faster than FULL.
 *    busy_timeout=5000   wait up to 5s for a contended write before
 *                        SQLITE_BUSY (instead of immediate fail).
 *    cache_size=-65536   64 MiB of page cache per connection (negative
 *                        = KiB; saves a fight with the default 2 MiB).
 *    temp_store=MEMORY   use RAM for temp tables / sort buffers.
 *    mmap_size=268M      memory-mapped I/O for the read path.
 *    foreign_key_check   one-shot integrity probe at boot.            */
const DB_PATH = process.env.DB_PATH ?? path.join(import.meta.dir, "..", "data.db");

export const db = new Database(DB_PATH, { create: true });
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA synchronous = NORMAL;");
db.exec("PRAGMA busy_timeout = 5000;");
db.exec("PRAGMA cache_size = -65536;");
db.exec("PRAGMA temp_store = MEMORY;");
db.exec("PRAGMA mmap_size = 268435456;");

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
