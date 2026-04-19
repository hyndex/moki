import { createHash, createPublicKey, verify } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { rootDir } from "./workspace-utils.mjs";

const signaturePath = path.join(rootDir, "artifacts", "provenance", "release-signature.json");
if (!existsSync(signaturePath)) {
  console.error("Missing release signature manifest.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(signaturePath, "utf8"));
const signedPath = path.join(rootDir, manifest.signedPath);
if (!existsSync(signedPath)) {
  console.error(`Missing signed payload '${manifest.signedPath}'.`);
  process.exit(1);
}

if (process.env.PLATFORM_REQUIRE_ENV_SIGNING === "true" && manifest.source !== "env") {
  console.error("Release verification requires environment-backed signing.");
  process.exit(1);
}

const payload = readFileSync(signedPath);
const payloadSha256 = createHash("sha256").update(payload).digest("hex");
if (payloadSha256 !== manifest.payloadSha256) {
  console.error("Signed payload checksum does not match manifest.");
  process.exit(1);
}

const publicKey = createPublicKey(manifest.publicKeyPem);
const algorithm = manifest.keyType === "ed25519" || manifest.keyType === "ed448" ? null : "sha256";
const verified = verify(algorithm, payload, publicKey, Buffer.from(manifest.signatureBase64, "base64"));

if (!verified || manifest.verified !== true || manifest.status !== "signed") {
  console.error("Release signature verification failed.");
  process.exit(1);
}

console.log(`Verified release signature for ${manifest.signedPath}.`);
