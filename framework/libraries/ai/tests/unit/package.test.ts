import { describe, expect, it } from "bun:test";
import { defineAction } from "@platform/schema";
import { z } from "zod";

import {
  createModelRegistry,
  createProviderError,
  createToolContract,
  invokeModel,
  packageId,
  toolRequiresApproval
} from "../../src";

describe("ai", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("ai");
  });

  it("generates tool contracts from action metadata", () => {
    const tool = createToolContract(
      defineAction({
        id: "crm.contacts.archive",
        input: z.object({ contactId: z.string() }),
        output: z.object({ ok: z.literal(true) }),
        permission: "crm.contacts.archive",
        idempotent: true,
        audit: true,
        ai: {
          purpose: "Archive a duplicate contact record after human confirmation.",
          riskLevel: "high",
          approvalMode: "required",
          groundingInputs: [{ sourceId: "crm.contacts.view", required: true }],
          resultSummaryHint: "Summarize the archived contact and the reason.",
          outputRedactionPathHints: ["contactId"]
        },
        handler: () => ({ ok: true as const })
      })
    );

    expect(tool.id).toBe("crm.contacts.archive");
    expect(tool.inputSchema.type).toBe("object");
    expect(tool.riskLevel).toBe("high");
    expect(tool.policies).toContain("tool.require_approval");
    expect(tool.outputRedactionPathHints).toEqual(["contactId"]);
    expect(toolRequiresApproval(tool)).toBe(true);
  });

  it("invokes provider-neutral models with guardrails and retries", async () => {
    let attempts = 0;
    const registry = createModelRegistry([
      {
        id: "gpt-test",
        provider: "openai",
        timeoutMs: 1_000
      }
    ]);

    const result = await invokeModel({
      registry,
      providers: {
        openai: {
          id: "openai",
          invoke(request) {
            attempts += 1;
            if (attempts === 1) {
              return Promise.reject(createProviderError("provider.overloaded", "busy", true));
            }
            return Promise.resolve({
              modelId: request.model.id,
              provider: "openai",
              outputText: "ok",
              toolCalls: []
            });
          }
        }
      },
      request: {
        modelId: "gpt-test",
        prompt: "hello"
      },
      guardrails: [
        ({ prompt }) => {
          if (prompt.length === 0) {
            throw new Error("prompt required");
          }
        }
      ],
      retryAttempts: 2
    });

    expect(result.outputText).toBe("ok");
    expect(attempts).toBe(2);
  });
});
