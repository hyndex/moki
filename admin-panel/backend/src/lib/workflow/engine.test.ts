/** Smoke test for the workflow engine.
 *
 *  Why this file is shaped the way it is:
 *  - The engine reads the SAME `db` singleton the production app uses.
 *    To avoid polluting `data.db`, we set `DB_PATH` to a tmp file
 *    BEFORE importing `db.ts` (transitively `engine.ts`). Bun caches
 *    module imports; we route through dynamic `import()` after env
 *    setup so the order is deterministic.
 *  - We NEVER import this file from `main.ts`. `bun run start` won't
 *    pick it up — Bun only treats it as a test under `bun test`. */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let dataDir: string;
type Eng = typeof import("./engine");
type Bus = typeof import("../event-bus");
let engine: Eng;
let bus: Bus;
let dbModule: typeof import("../../db");

beforeAll(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "gutu-workflow-test-"));
  // Re-route the SQLite handle BEFORE engine.ts imports it.
  process.env.DB_PATH = path.join(dataDir, "test.db");
  process.env.NODE_ENV = "test";

  // Import after env is set so db.ts opens our tmp file.
  dbModule = await import("../../db");
  const migrations = await import("../../migrations");
  migrations.migrate();
  engine = await import("./engine");
  bus = await import("../event-bus");
});

afterAll(async () => {
  // Stop the engine so the worker loop / cron tick exits cleanly.
  engine.stopWorkflowEngine();
  bus.__resetEventBus();
  await rm(dataDir, { recursive: true, force: true });
});

describe("workflow engine — database-event trigger", () => {
  it(
    "creates a run with a successful node output when a matching event fires",
    async () => {
      const { db, nowIso } = dbModule;

      const tenantId = "t-test-1";
      const workflowId = "wf-test-1";

      // Seed a workflow that listens for `crm.contact.created` and
      // runs a single `log` action.
      const definition = {
        trigger: {
          kind: "database-event",
          resource: "crm.contact",
          on: ["created"],
        },
        nodes: [
          {
            id: "n1",
            type: "log",
            params: { message: "hello {{ trigger.record.name }}" },
          },
        ],
        edges: [{ from: "start", to: "n1" }],
        variables: { initial: {} },
      };
      db.prepare(
        `INSERT INTO workflows
           (id, tenant_id, name, description, status, definition, version,
            created_by, created_at, updated_at)
         VALUES (?, ?, 'Smoke', NULL, 'active', ?, 1, 'tester', ?, ?)`,
      ).run(workflowId, tenantId, JSON.stringify(definition), nowIso(), nowIso());

      // Spin up the engine — subscribes to the bus.
      engine.startWorkflowEngine();

      // Emit a record event the trigger should match.
      bus.emitRecordEvent({
        type: "record.created",
        resource: "crm.contact",
        recordId: "rec-1",
        tenantId,
        actor: "tester@local",
        record: { id: "rec-1", name: "Ada" },
      });

      // The bus runs subscribers in a microtask; the worker is async.
      // Poll the runs table until we see the row land.
      const deadline = Date.now() + 5_000;
      let runRow: { status: string; output: string | null; error: string | null } | undefined;
      while (Date.now() < deadline) {
        runRow = db
          .prepare(
            `SELECT status, output, error FROM workflow_runs WHERE workflow_id = ?
              ORDER BY started_at DESC LIMIT 1`,
          )
          .get(workflowId) as typeof runRow;
        if (runRow && runRow.status !== "running") break;
        await new Promise((r) => setTimeout(r, 25));
      }

      expect(runRow).toBeDefined();
      expect(runRow!.status).toBe("success");
      expect(runRow!.error).toBeNull();
      const output = JSON.parse(runRow!.output!) as Record<string, { ok: boolean }>;
      expect(output.n1).toBeDefined();
      expect(output.n1.ok).toBe(true);
    },
    10_000,
  );
});
