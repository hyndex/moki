import { describe, expect, it } from "bun:test";

import {
  buildSpanAttributes,
  createTelemetryBootstrap,
  createTelemetryContext,
  packageId,
  withSpan
} from "../../src";

describe("observability", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("observability");
  });

  it("builds stable span attributes from telemetry context", () => {
    expect(
      buildSpanAttributes(
        createTelemetryContext({
          requestId: "req-1",
          tenantId: "tenant-a",
          actorId: "actor-1"
        })
      )
    ).toEqual({
      actorId: "actor-1",
      requestId: "req-1",
      tenantId: "tenant-a"
    });
  });

  it("creates startable telemetry bootstrap contracts", async () => {
    const bootstrap = createTelemetryBootstrap({
      serviceName: "platform",
      environment: "test",
      releaseId: "0.1.0"
    });

    await bootstrap.start();
    expect(bootstrap.started).toBe(true);
    expect(bootstrap.resourceAttributes).toEqual({
      "deployment.environment": "test",
      "service.name": "platform",
      "service.version": "0.1.0"
    });
    await bootstrap.shutdown();
    expect(bootstrap.started).toBe(false);
  });

  it("runs operations inside instrumented spans", async () => {
    expect(
      await withSpan(
        "platform.test",
        {
          requestId: "req-1"
        },
        () => Promise.resolve("ok")
      )
    ).toBe("ok");
  });
});
