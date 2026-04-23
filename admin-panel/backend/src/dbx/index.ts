import { loadConfig } from "../config";
import { SqliteDbx } from "./sqlite";
import { PostgresDbx } from "./postgres";
import type { Dbx } from "./types";

export type { Dbx, DbxExecResult, SqlParam } from "./types";

let instance: Dbx | null = null;

/** Lazily resolve the active driver based on env. Called once at boot and
 *  again from every request handler — all calls share one pool. */
export function dbx(): Dbx {
  if (instance) return instance;
  const cfg = loadConfig();
  if (cfg.dbKind === "postgres") {
    if (!cfg.pgUrl) {
      console.error("[dbx] DB_KIND=postgres but DATABASE_URL is not set.");
      process.exit(1);
    }
    instance = new PostgresDbx(cfg.pgUrl, cfg.pgMax);
  } else {
    instance = new SqliteDbx(cfg.sqlitePath);
  }
  return instance;
}

/** Replace the active driver (tests only). */
export function setDbxForTests(replacement: Dbx): void {
  instance = replacement;
}

/** Close & clear. */
export async function closeDbx(): Promise<void> {
  if (instance) {
    await instance.close();
    instance = null;
  }
}
