import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { BUN_BIN, ensureDir, rootDir } from "./workspace-utils.mjs";

const provenancePath = path.join(rootDir, "artifacts", "provenance", "build-provenance.json");
if (!existsSync(provenancePath)) {
  const result = spawnSync(BUN_BIN, ["run", "provenance:generate"], {
    cwd: rootDir,
    stdio: "inherit",
    env: { ...process.env, BUN_BIN }
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const outputDir = ensureDir(path.join(rootDir, "artifacts", "provenance"));
const payload = readFileSync(provenancePath);
const payloadSha256 = createHash("sha256").update(payload).digest("hex");
const signingMaterial = loadSigningMaterial();

if (!signingMaterial) {
  console.error("No signing material is available.");
  process.exit(1);
}

if (process.env.PLATFORM_REQUIRE_ENV_SIGNING === "true" && signingMaterial.source !== "env") {
  console.error("Release signing requires environment-provided key material.");
  process.exit(1);
}

const algorithm =
  signingMaterial.privateKey.asymmetricKeyType === "ed25519" || signingMaterial.privateKey.asymmetricKeyType === "ed448"
    ? null
    : "sha256";
const signature = sign(algorithm, payload, signingMaterial.privateKey);
const verification = verify(algorithm, payload, signingMaterial.publicKey, signature);

if (!verification) {
  console.error("Signature verification failed.");
  process.exit(1);
}

writeFileSync(
  path.join(outputDir, "release-signature.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      status: "signed",
      source: signingMaterial.source,
      signedPath: path.relative(rootDir, provenancePath),
      payloadSha256,
      keyType: signingMaterial.privateKey.asymmetricKeyType,
      publicKeyFingerprintSha256: createHash("sha256")
        .update(signingMaterial.publicKey.export({ format: "pem", type: "spki" }))
        .digest("hex"),
      publicKeyPem: signingMaterial.publicKey.export({ format: "pem", type: "spki" }).toString(),
      signatureBase64: signature.toString("base64"),
      verified: verification
    },
    null,
    2
  )
);

function loadSigningMaterial() {
  const filePath = process.env.PLATFORM_SIGNING_PRIVATE_KEY_FILE;
  const inlinePem = process.env.PLATFORM_SIGNING_PRIVATE_KEY_PEM;
  const inlinePemBase64 = process.env.PLATFORM_SIGNING_PRIVATE_KEY_PEM_B64;

  if (filePath) {
    const privateKey = createPrivateKey(readFileSync(filePath, "utf8"));
    return {
      source: "env",
      privateKey,
      publicKey: createPublicKey(privateKey)
    };
  }
  if (inlinePem) {
    const privateKey = createPrivateKey(inlinePem);
    return {
      source: "env",
      privateKey,
      publicKey: createPublicKey(privateKey)
    };
  }
  if (inlinePemBase64) {
    const privateKey = createPrivateKey(Buffer.from(inlinePemBase64, "base64").toString("utf8"));
    return {
      source: "env",
      privateKey,
      publicKey: createPublicKey(privateKey)
    };
  }

  const devKeyPath = path.join(rootDir, "tooling", "signing", "dev-signing-private-key.pem");
  if (existsSync(devKeyPath)) {
    const privateKey = createPrivateKey(readFileSync(devKeyPath, "utf8"));
    return {
      source: "dev-test-key",
      privateKey,
      publicKey: createPublicKey(privateKey)
    };
  }

  return null;
}
