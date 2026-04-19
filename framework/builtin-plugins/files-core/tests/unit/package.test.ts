import { describe, expect, it } from "bun:test";
import { executeAction } from "@platform/schema";
import manifest from "../../package";
import { registerFileAssetAction } from "../../src/actions/default.action";
import { registerFileAsset } from "../../src/services/main.service";

describe("plugin manifest", () => {
  it("keeps a stable package id and primary capability", () => {
    expect(manifest.id).toBe("files-core");
    expect(manifest.providesCapabilities).toContain("files.assets");
  });

  it("quarantines risky public uploads before activation", () => {
    expect(
      registerFileAsset({
        assetId: "c4143d92-ac60-40f7-8233-45e5ff6c6863",
        tenantId: "decb8cf3-7f38-47e9-9496-8724426f668d",
        fileName: "portal-upload.png",
        objectKey: "tenant/decb8cf3/assets/portal-upload.png",
        storageAdapter: "s3",
        contentType: "image/png",
        bytes: 2048,
        visibility: "public",
        checksum: "abc12345ff67",
        uploadedBy: "portal-user",
        reason: "publish upload"
      })
    ).toEqual({
      ok: true,
      nextStatus: "quarantined",
      malwareStatus: "pending",
      secretRefs: ["S3_STORAGE_SIGNING_KEY"],
      downloadPolicy: "blocked"
    });
  });

  it("validates normal private asset registration through the public contract", async () => {
    const result = await executeAction(registerFileAssetAction, {
      assetId: "c4143d92-ac60-40f7-8233-45e5ff6c6863",
      tenantId: "decb8cf3-7f38-47e9-9496-8724426f668d",
      fileName: "invoice.pdf",
      objectKey: "tenant/decb8cf3/docs/invoice.pdf",
      storageAdapter: "local",
      contentType: "application/pdf",
      bytes: 42000,
      visibility: "private",
      checksum: "abc12345ff67",
      uploadedBy: "staff",
      reason: "archive generated invoice"
    });

    expect(result).toEqual({
      ok: true,
      nextStatus: "ready",
      malwareStatus: "clean",
      secretRefs: [],
      downloadPolicy: "signed-url"
    });
  });
});
