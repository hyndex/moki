import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const catalogPath = join(root, "catalog", "index.json");
const channelsRoot = join(root, "channels");

if (!existsSync(catalogPath)) {
  throw new Error(`Missing catalog index at ${catalogPath}.`);
}

const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
assertCatalogShape(catalog, "catalog/index.json");

const catalogIds = new Map(catalog.packages.map((entry) => [entry.id, entry]));
const channelFiles = existsSync(channelsRoot)
  ? readdirSync(channelsRoot).filter((entry) => entry.endsWith(".json")).sort()
  : [];

for (const channelFile of channelFiles) {
  const channelPath = join(channelsRoot, channelFile);
  const channel = JSON.parse(readFileSync(channelPath, "utf8"));
  assertChannelShape(channel, `channels/${channelFile}`);

  for (const entry of channel.packages) {
    if (!catalogIds.has(entry.id)) {
      throw new Error(`Channel ${channelFile} references ${entry.id}, which is missing from catalog/index.json.`);
    }
    assertSignedArtifact(entry, `channels/${channelFile}`);
    if (process.env.SKIP_REMOTE_ASSET_CHECK !== "1") {
      await assertRemoteAsset(entry.artifact.uri);
    }
  }
}

function assertCatalogShape(payload, label) {
  if (payload.schemaVersion !== 1) {
    throw new Error(`${label} must declare schemaVersion 1.`);
  }
  if (!Array.isArray(payload.packages)) {
    throw new Error(`${label} must contain a packages array.`);
  }
  assertSortedAndUnique(payload.packages, label);
}

function assertChannelShape(payload, label) {
  if (payload.schemaVersion !== 1) {
    throw new Error(`${label} must declare schemaVersion 1.`);
  }
  if (typeof payload.id !== "string" || payload.id.length === 0) {
    throw new Error(`${label} must declare a non-empty id.`);
  }
  if (!Array.isArray(payload.packages)) {
    throw new Error(`${label} must contain a packages array.`);
  }
  assertSortedAndUnique(payload.packages, label);
}

function assertSortedAndUnique(entries, label) {
  const ids = entries.map((entry) => entry.id);
  const sorted = [...ids].sort((left, right) => left.localeCompare(right));
  if (ids.join("\n") !== sorted.join("\n")) {
    throw new Error(`${label} packages must be sorted by id.`);
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error(`${label} packages contain duplicate ids.`);
  }
}

function assertSignedArtifact(entry, label) {
  if (!entry.artifact || typeof entry.artifact.uri !== "string") {
    throw new Error(`${label} entry ${entry.id} must include an installable artifact.`);
  }
  if (typeof entry.artifact.sha256 !== "string" || entry.artifact.sha256.length !== 64) {
    throw new Error(`${label} entry ${entry.id} must include a sha256 digest.`);
  }
  if (typeof entry.artifact.signature !== "string" || entry.artifact.signature.length === 0) {
    throw new Error(`${label} entry ${entry.id} must include a signature.`);
  }
  if (typeof entry.artifact.publicKeyPem !== "string" || entry.artifact.publicKeyPem.length === 0) {
    throw new Error(`${label} entry ${entry.id} must include a publicKeyPem.`);
  }
}

async function assertRemoteAsset(uri) {
  let response = await fetch(uri, {
    method: "HEAD",
    redirect: "follow",
    headers: {
      "user-agent": "gutu-catalog-validate"
    }
  });

  if (!response.ok) {
    response = await fetch(uri, {
      method: "GET",
      redirect: "follow",
      headers: {
        "user-agent": "gutu-catalog-validate"
      }
    });
  }

  if (!response.ok) {
    throw new Error(`Remote asset check failed for ${uri}: ${response.status}.`);
  }
}
