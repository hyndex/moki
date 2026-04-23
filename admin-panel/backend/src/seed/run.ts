import { db } from "../db";
import { migrate } from "../migrations";
import { seedUsers } from "./users";
import { seedSalesCrm } from "./sales-crm";
import { seedFactory } from "./factory";
import { seedExtended } from "./extended";

/** Idempotent: if the records table already has data, do nothing unless
 *  `force: true` is passed. Auth users are seeded when empty regardless. */
export async function seedAll(opts: { force?: boolean } = {}): Promise<void> {
  migrate();

  const userCount = await seedUsers();
  if (userCount > 0) console.log(`[seed] users: ${userCount}`);

  const row = db.prepare("SELECT COUNT(*) AS c FROM records").get() as { c: number };
  if (row.c > 0 && !opts.force) {
    // Still top up any extended resources that are missing (backfill after upgrade).
    const hasExtended = db
      .prepare("SELECT COUNT(*) AS c FROM records WHERE resource = 'platform.metric'")
      .get() as { c: number };
    if (hasExtended.c === 0) {
      console.log("[seed] backfilling extended resources…");
      const ext = seedExtended();
      console.log(
        `[seed] backfilled ${Object.values(ext).reduce((a, b) => a + b, 0)} records across ${Object.keys(ext).length} extended resources`,
      );
      return;
    }
    console.log(`[seed] records: ${row.c} already present, skipping (pass --force to reseed)`);
    return;
  }
  if (opts.force) {
    db.exec("DELETE FROM records");
    console.log("[seed] cleared records table (force)");
  }

  const t0 = Date.now();
  const crm = seedSalesCrm();
  const factory = seedFactory();
  const extended = seedExtended();
  const all = { ...crm, ...factory, ...extended };
  const total = Object.values(all).reduce((a, b) => a + b, 0);
  console.log(
    `[seed] inserted ${total} records across ${Object.keys(all).length} resources in ${Date.now() - t0}ms`,
  );
  for (const [res, n] of Object.entries(all).sort()) {
    console.log(`  ${res.padEnd(40)} ${String(n).padStart(4)}`);
  }
}

// Allow `bun run src/seed/run.ts --force` for CLI reseed.
if (import.meta.main) {
  const force = process.argv.includes("--force");
  await seedAll({ force });
  process.exit(0);
}
