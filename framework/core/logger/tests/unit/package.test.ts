import { describe, expect, it } from "bun:test";

import {
  createLogContext,
  createPlatformLogger,
  createRedactionPolicy,
  mergeRedactionPolicies,
  packageId,
  redactValue,
  sanitizeLogPayload,
  withLogContext
} from "../../src";

describe("logger", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("logger");
  });

  it("redacts sensitive fields without stripping safe context", () => {
    const policy = mergeRedactionPolicies(
      createRedactionPolicy(),
      createRedactionPolicy({
        paths: ["credentials.apiKey"]
      })
    );

    expect(
      redactValue(
        {
          requestId: "req-1",
          password: "secret",
          credentials: {
            apiKey: "token-1"
          }
        },
        policy
      )
    ).toEqual({
      requestId: "req-1",
      password: "[redacted]",
      credentials: {
        apiKey: "[redacted]"
      }
    });
  });

  it("creates request-scoped child loggers", () => {
    const logger = createPlatformLogger();
    const child = withLogContext(
      logger,
      createLogContext({
        requestId: "req-1",
        tenantId: "tenant-a"
      })
    );

    expect(child.bindings()).toMatchObject({
      requestId: "req-1",
      tenantId: "tenant-a"
    });
  });

  it("sanitizes arbitrary payloads into structured log records", () => {
    expect(sanitizeLogPayload({ token: "secret", ok: true })).toEqual({
      token: "[redacted]",
      ok: true
    });
  });
});
