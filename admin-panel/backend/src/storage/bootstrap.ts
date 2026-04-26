/** Wire up the storage registry at server boot.
 *
 *  Reads config from env. In production, this would hydrate from a
 *  `storage_backends` table populated via the admin UI; for the reference
 *  implementation we support both modes:
 *
 *    STORAGE_DEFAULT=local                    (default — uses FILES_ROOT)
 *    STORAGE_DEFAULT=s3
 *    STORAGE_BACKENDS_JSON=[...backend rows]  (override full config)
 *
 *  Every S3 variety (AWS, R2, MinIO, Wasabi, etc.) goes through the same
 *  `s3` kind with a different config — that's the whole point of the
 *  adapter abstraction. */

import { randomBytes } from "node:crypto";
import path from "node:path";
import {
  getStorageRegistry,
  type StorageBackendConfig,
} from "./index";
import { LocalStorageAdapter, type LocalAdapterConfig } from "./adapters/local";
import { S3StorageAdapter, type S3AdapterConfig } from "./adapters/s3";

export interface BootstrapOptions {
  /** The `filesRoot` from the admin-panel config — used as the rootDir for
   *  the default local backend. */
  filesRoot: string;
  /** The backend's public URL. Used to issue local-signed URLs. */
  publicBaseUrl: string;
  /** Tenant id of the default tenant. Adapters are scoped per-tenant so
   *  we instantiate once per tenant when requests come in; at bootstrap
   *  we only register factories + declare the process-wide default. */
  defaultTenantId: string;
}

function parseStorageBackendsEnv(): StorageBackendConfig[] | null {
  const raw = process.env.STORAGE_BACKENDS_JSON?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      console.error("[storage] STORAGE_BACKENDS_JSON must be an array");
      return null;
    }
    return parsed as StorageBackendConfig[];
  } catch (err) {
    console.error("[storage] failed to parse STORAGE_BACKENDS_JSON:", (err as Error).message);
    return null;
  }
}

function localDefaultConfig(opts: BootstrapOptions): LocalAdapterConfig {
  // Production refuses to boot with an ephemeral signing key — every
  // previously-issued presigned URL would silently 401 after a restart,
  // breaking downloads in flight. Dev tolerates it with a warning so
  // local iteration isn't blocked.
  const isProd = process.env.NODE_ENV === "production";
  const fromEnv = process.env.STORAGE_SIGNING_KEY?.trim();
  if (isProd && !fromEnv) {
    throw new Error(
      "[storage] STORAGE_SIGNING_KEY is required in production. Generate with `openssl rand -hex 32` and set in your environment.",
    );
  }
  if (isProd && fromEnv && fromEnv.length < 32) {
    throw new Error(
      "[storage] STORAGE_SIGNING_KEY too short (need ≥32 chars / ≥128 bits). Use `openssl rand -hex 32`.",
    );
  }
  const signingKey = fromEnv ?? randomBytes(32).toString("hex");
  if (!fromEnv) {
    console.warn(
      "[storage] STORAGE_SIGNING_KEY not set — generated an ephemeral key. Presigned URLs will not survive restart. (Required in production.)",
    );
  }
  return {
    rootDir: path.resolve(opts.filesRoot),
    signingKey,
    publicBaseUrl: opts.publicBaseUrl,
    tenantPrefixTemplate: "{tenantId}",
  };
}

function s3DefaultFromEnv(): S3AdapterConfig | null {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION;
  if (!bucket || !region) return null;
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "1";
  return {
    provider:
      (process.env.S3_PROVIDER as S3AdapterConfig["provider"]) ?? "custom",
    bucket,
    region,
    ...(endpoint !== undefined && { endpoint }),
    forcePathStyle,
    ...(accessKeyId &&
      secretAccessKey && {
        credentials: { accessKeyId, secretAccessKey },
      }),
    tenantPrefixTemplate: "{tenantId}",
  };
}

export function bootstrapStorage(opts: BootstrapOptions): void {
  const registry = getStorageRegistry();

  // Register factories for both built-in kinds.
  registry.registerFactory({
    kind: "local",
    validateConfig: () => null,
    create: (config, tenantId) =>
      new LocalStorageAdapter(config as LocalAdapterConfig, tenantId),
  });
  registry.registerFactory({
    kind: "s3",
    validateConfig: (config) => {
      const c = config as Partial<S3AdapterConfig> | null | undefined;
      if (!c || typeof c !== "object") return "config required";
      if (!c.bucket) return "bucket required";
      if (!c.region) return "region required";
      return null;
    },
    create: (config, tenantId) =>
      new S3StorageAdapter(config as S3AdapterConfig, tenantId),
  });

  const override = parseStorageBackendsEnv();
  if (override) {
    for (const backend of override) {
      registry.declareBackend(backend, opts.defaultTenantId);
    }
    console.log(`[storage] loaded ${override.length} backend(s) from STORAGE_BACKENDS_JSON`);
    return;
  }

  const pick = (process.env.STORAGE_DEFAULT ?? "local").toLowerCase();
  if (pick === "s3") {
    const s3 = s3DefaultFromEnv();
    if (!s3) {
      console.error(
        "[storage] STORAGE_DEFAULT=s3 but S3_BUCKET + S3_REGION are not set. Falling back to local.",
      );
    } else {
      registry.declareBackend(
        {
          id: "default",
          kind: "s3",
          label: `S3 (${s3.provider ?? "custom"})`,
          config: s3,
          isDefault: true,
          acceptsWrites: true,
        },
        opts.defaultTenantId,
      );
      console.log(`[storage] default backend: s3 ${s3.bucket}@${s3.endpoint ?? s3.region}`);
      return;
    }
  }

  // Local default.
  registry.declareBackend(
    {
      id: "default",
      kind: "local",
      label: "Local filesystem",
      config: localDefaultConfig(opts),
      isDefault: true,
      acceptsWrites: true,
    },
    opts.defaultTenantId,
  );
  console.log(`[storage] default backend: local @ ${opts.filesRoot}`);
}
