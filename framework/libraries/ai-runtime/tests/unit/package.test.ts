import { describe, expect, it } from "bun:test";

import { defineAction } from "@platform/schema";
import { createToolContract } from "@platform/ai";
import { z } from "zod";

import {
  AgentBudgetExceededError,
  assertReplayFingerprint,
  assertToolAllowed,
  completeAgentRun,
  consumeBudget,
  createAgentRunRecord,
  defineAgent,
  packageId,
  pauseAgentRunForApproval
} from "../../src";

describe("ai-runtime", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("ai-runtime");
  });

  it("creates durable run records with replay fingerprints and approval checkpoints", () => {
    const archiveTool = createToolContract(
      defineAction({
        id: "crm.contacts.archive",
        input: z.object({ contactId: z.string() }),
        output: z.object({ ok: z.literal(true) }),
        permission: "crm.contacts.archive",
        idempotent: true,
        audit: true,
        ai: {
          purpose: "Archive a CRM contact.",
          riskLevel: "high",
          approvalMode: "required"
        },
        handler: () => ({ ok: true as const })
      })
    );

    const agent = defineAgent({
      id: "crm-account-manager",
      label: "CRM Account Manager",
      description: "Runs CRM follow-up automation with approvals.",
      defaultModelId: "gpt-test",
      capabilities: {
        toolIds: ["crm.contacts.archive"]
      },
      budget: {
        maxSteps: 6,
        maxToolCalls: 3,
        maxRuntimeMs: 5_000
      },
      failurePolicy: {
        maxRetryAttempts: 2,
        retryableCodes: ["ai.provider.timeout"],
        pauseOnApprovalRequired: true,
        failOnReplayMismatch: true,
        failOnGuardrailBlock: true
      }
    });

    const run = createAgentRunRecord(agent, {
      agentId: agent.id,
      tenantId: "tenant-1",
      packageId: "ai-core",
      prompt: "Archive duplicate contact c-1",
      tools: [archiveTool],
      actorId: "actor-1",
      promptVersionId: "prompt-v1",
      memorySnapshotRefs: ["crm.contacts.snapshot"],
      policyDecisions: ["tool.require_approval"]
    });

    expect(run.allowedToolIds).toEqual(["crm.contacts.archive"]);
    expect(run.replayFingerprint).toHaveLength(64);
    assertReplayFingerprint(run, run.replayFingerprint);

    const waiting = pauseAgentRunForApproval(run, {
      stepId: "step-approval",
      toolId: "crm.contacts.archive",
      reason: "High-risk archive requires support approval."
    });

    expect(waiting.status).toBe("waiting-approval");
    expect(waiting.checkpoints[0]?.state).toBe("pending");
    expect(completeAgentRun(waiting).status).toBe("completed");
  });

  it("fails closed on denied tools and exhausted budgets", () => {
    const agent = defineAgent({
      id: "report-agent",
      label: "Report Agent",
      description: "Builds internal reports only.",
      defaultModelId: "gpt-test",
      capabilities: {
        toolIds: ["reports.run"],
        deniedToolIds: ["reports.delete"]
      },
      budget: {
        maxSteps: 1,
        maxToolCalls: 1,
        maxRuntimeMs: 1_000
      },
      failurePolicy: {
        maxRetryAttempts: 1,
        retryableCodes: [],
        pauseOnApprovalRequired: false,
        failOnReplayMismatch: true,
        failOnGuardrailBlock: true
      }
    });

    const run = createAgentRunRecord(agent, {
      agentId: agent.id,
      tenantId: "tenant-1",
      packageId: "ai-core",
      prompt: "Run report",
      tools: [],
      actorId: "actor-1"
    });

    expect(() => assertToolAllowed(run, "reports.delete")).toThrow();
    expect(() => consumeBudget(run, { stepCount: 2 })).toThrow(AgentBudgetExceededError);
  });
});
