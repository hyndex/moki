import { describe, expect, it } from "bun:test";
import { executeAction } from "@platform/schema";
import manifest from "../../package";
import { scheduleJobExecutionAction } from "../../src/actions/default.action";
import { jobDefinitionKeys } from "../../src/jobs/catalog";
import { scheduleJobExecution } from "../../src/services/main.service";

describe("plugin manifest", () => {
  it("keeps a stable package id and primary capability", () => {
    expect(manifest.id).toBe("jobs-core");
    expect(manifest.providesCapabilities).toContain("jobs.executions");
  });

  it("publishes explicit queue job envelopes", () => {
    expect(jobDefinitionKeys).toEqual(["crm.sync-segments", "files.scan-uploads", "notifications.dispatch"]);
  });

  it("queues immediate executions with observability metadata", () => {
    expect(
      scheduleJobExecution({
        executionId: "35d875b5-a2e8-4ebb-a993-ecf15c17a7c1",
        tenantId: "c8bf9151-bc0a-4bc7-a6e1-cf54cb0b8284",
        jobKey: "notifications.dispatch",
        concurrency: 2,
        retries: 4,
        timeoutMs: 20_000,
        reason: "dispatch due notifications"
      })
    ).toEqual({
      ok: true,
      nextStatus: "queued",
      queue: "notifications",
      observabilityKey: "c8bf9151-bc0a-4bc7-a6e1-cf54cb0b8284:notifications.dispatch:35d875b5-a2e8-4ebb-a993-ecf15c17a7c1",
      concurrency: 2,
      retries: 4
    });
  });

  it("validates the scheduling contract for delayed work", async () => {
    const result = await executeAction(scheduleJobExecutionAction, {
      executionId: "35d875b5-a2e8-4ebb-a993-ecf15c17a7c1",
      tenantId: "c8bf9151-bc0a-4bc7-a6e1-cf54cb0b8284",
      jobKey: "crm.sync-segments",
      runAt: new Date(Date.now() + 60_000).toISOString(),
      concurrency: 1,
      retries: 2,
      timeoutMs: 30_000,
      reason: "nightly segment refresh"
    });

    expect(result).toEqual({
      ok: true,
      nextStatus: "scheduled",
      queue: "crm-sync",
      observabilityKey: "c8bf9151-bc0a-4bc7-a6e1-cf54cb0b8284:crm.sync-segments:35d875b5-a2e8-4ebb-a993-ecf15c17a7c1",
      concurrency: 1,
      retries: 2
    });
  });
});
