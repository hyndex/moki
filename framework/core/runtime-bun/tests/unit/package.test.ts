import { describe, expect, it } from "bun:test";

import {
  MissingEnvironmentVariableError,
  RuntimeFetchHostError,
  RuntimeTimeoutError,
  createDeterministicEnvSnapshot,
  createRuntimeLifecycleHooks,
  fetchWithTimeout,
  getEnv,
  getOptionalEnv,
  getRuntimeCapabilities,
  packageId,
  readJsonFile,
  withTimeout
} from "../../src";

describe("runtime-bun", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("runtime-bun");
  });

  it("reports runtime capabilities", () => {
    const capabilities = getRuntimeCapabilities();
    expect(capabilities["bun-runtime"]).toBe(true);
    expect(capabilities["bun-serve"]).toBe(true);
    expect(capabilities["abort-timeout"]).toBe(true);
  });

  it("resolves optional and required environment variables", () => {
    expect(getOptionalEnv("OPTIONAL_VALUE", { OPTIONAL_VALUE: "ready" })).toBe("ready");
    expect(getEnv("REQUIRED_VALUE", undefined, { REQUIRED_VALUE: "set" })).toBe("set");
    expect(getEnv("MISSING_VALUE", "fallback", {})).toBe("fallback");
    expect(() => getEnv("MISSING_VALUE", undefined, {})).toThrow(MissingEnvironmentVariableError);
  });

  it("creates deterministic redacted environment snapshots", () => {
    expect(
      createDeterministicEnvSnapshot({
        env: {
          APP_NAME: "framework",
          API_TOKEN: "secret-token",
          Z_LAST: "z"
        },
        exclude: ["Z_LAST"]
      })
    ).toEqual({
      values: {
        API_TOKEN: "secret-token",
        APP_NAME: "framework"
      },
      redacted: {
        API_TOKEN: "[redacted]",
        APP_NAME: "framework"
      }
    });
  });

  it("reads json files through the runtime wrapper", async () => {
    const value = await readJsonFile<{ name: string }>("/Users/chinmoybhuyan/Desktop/Personal/Framework/package.json");
    expect(value.name).toBe("@repo/platform");
  });

  it("enforces allowlisted hosts for runtime fetches", async () => {
    try {
      await fetchWithTimeout("https://example.com", {
        allowHosts: ["api.internal.local"],
        fetchImpl: () => Promise.resolve(new Response("ok"))
      });
      throw new Error("expected host allowlist enforcement to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeFetchHostError);
    }
  });

  it("times out slow operations deterministically", async () => {
    try {
      await withTimeout(async (signal) => {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 25);
          signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(signal.reason instanceof Error ? signal.reason : new RuntimeTimeoutError(5));
            },
            { once: true }
          );
        });
      }, 5);
      throw new Error("expected timeout to trigger");
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeTimeoutError);
    }
  });

  it("runs startup hooks in registration order and shutdown hooks in reverse order", async () => {
    const hooks = createRuntimeLifecycleHooks();
    const calls: string[] = [];

    hooks.onStart(() => {
      calls.push("start:first");
    });
    hooks.onStart(() => {
      calls.push("start:second");
    });
    hooks.onShutdown(() => {
      calls.push("stop:first");
    });
    hooks.onShutdown(() => {
      calls.push("stop:second");
    });

    await hooks.startup();
    await hooks.shutdown();

    expect(calls).toEqual(["start:first", "start:second", "stop:second", "stop:first"]);
    expect(hooks.state).toBe("stopped");
  });
});
