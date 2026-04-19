import { describe, expect, it } from "bun:test";
import { z } from "zod";

import {
  defineConfigSchema,
  defineConfigSource,
  loadConfig,
  mergeConfigLayers,
  packageId,
  resolveConfig,
  secretRef
} from "../../src";

describe("config", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("config");
  });

  it("deep merges layered config objects", () => {
    expect(
      mergeConfigLayers(
        {
          auth: {
            cookieName: "platform"
          }
        } as Record<string, unknown>,
        {
          auth: {
            issuer: "https://example.test"
          }
        } as Record<string, unknown>
      )
    ).toEqual({
      auth: {
        cookieName: "platform",
        issuer: "https://example.test"
      }
    });
  });

  it("resolves typed layered config with secret references and redacted snapshots", async () => {
    const schema = defineConfigSchema(
      z.object({
        NODE_ENV: z.string(),
        auth: z.object({
          issuer: z.string().url(),
          apiToken: z.string()
        }),
        features: z.object({
          analytics: z.boolean()
        })
      })
    );

    const resolved = await resolveConfig({
      schema,
      env: {
        NODE_ENV: "test"
      },
      layers: [
        defineConfigSource({
          id: "base",
          kind: "inline",
          load: () => ({
            auth: {
              issuer: "https://platform.example.test"
            }
          })
        }),
        {
          auth: {
            apiToken: secretRef("auth/api-token")
          },
          features: {
            analytics: true
          }
        }
      ],
      secretResolver: (reference) => `resolved:${reference}`
    });

    expect(resolved.profile).toBe("default");
    expect(resolved.value.auth.apiToken).toBe("resolved:auth/api-token");
    expect(resolved.redactedSnapshot).toEqual({
      NODE_ENV: "test",
      auth: {
        apiToken: "[redacted]",
        issuer: "https://platform.example.test"
      },
      features: {
        analytics: true
      }
    });
    expect(Object.isFrozen(resolved.value)).toBe(true);
  });

  it("surfaces validation errors with explicit issue paths", async () => {
    try {
      await loadConfig({
        schema: z.object({
          auth: z.object({
            issuer: z.string().url()
          })
        }),
        env: {},
        layers: [
          {
            auth: {
              issuer: "not-a-url"
            }
          }
        ]
      });
      throw new Error("expected config validation to fail");
    } catch (error) {
      expect(error).toMatchObject({
        name: "ConfigValidationError",
        issues: [
          {
            path: "auth.issuer"
          }
        ]
      });
    }
  });

  it("requires a secret resolver when secret references are present", async () => {
    try {
      await resolveConfig({
        schema: z.object({
          auth: z.object({
            apiToken: z.string()
          })
        }),
        env: {},
        layers: [
          {
            auth: {
              apiToken: secretRef("auth/api-token")
            }
          }
        ]
      });
      throw new Error("expected secret resolution to fail");
    } catch (error) {
      expect(error).toMatchObject({
        name: "ConfigValidationError"
      });
    }
  });
});
