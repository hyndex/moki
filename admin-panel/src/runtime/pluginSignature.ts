/** Ed25519 signature verification for remote plugins.
 *
 *  Plugin publishers sign their bundle bytes with an Ed25519 private key.
 *  The signature (base64) + public-key id are declared in the manifest
 *  under `origin.signature` and `origin.signaturePublicKey`. The shell
 *  verifies before `import()` — a bundle whose signature doesn't match
 *  the declared public key is refused.
 *
 *  The shell ships with a trusted-keys list (empty by default). Operators
 *  add publisher public keys via the Plugin Inspector's "Trusted keys"
 *  panel. Only plugins signed by a trusted key can install from a URL
 *  unless the operator explicitly bypasses the check.
 *
 *  Production hardening:
 *    - All crypto via Web Crypto API (SubtleCrypto) — no JS libs.
 *    - Keys imported as SPKI DER (base64) — standard pgp/ssh-compatible.
 *    - Verification is constant-time (WebCrypto guarantee).
 *    - Signature + SRI are both checked; either fails → refuse. */

export interface SignatureDescriptor {
  /** base64 Ed25519 signature of the bundle bytes. */
  readonly signature: string;
  /** base64 SPKI-encoded public key used to verify. */
  readonly publicKey: string;
  /** Stable id for the key, e.g. "acme-prod-2024". */
  readonly keyId?: string;
}

export interface VerifyResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly keyId?: string;
}

/** Trusted keys registry — populated from localStorage + admin UI. */
const TRUSTED_KEYS_STORAGE_KEY = "gutu.plugin.trustedKeys";

export interface TrustedKey {
  readonly publicKey: string; // SPKI base64
  readonly keyId: string;
  readonly label: string;
  readonly addedAt: string;
}

export function loadTrustedKeys(): readonly TrustedKey[] {
  try {
    const raw = localStorage.getItem(TRUSTED_KEYS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TrustedKey[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTrustedKeys(keys: readonly TrustedKey[]): void {
  try {
    localStorage.setItem(TRUSTED_KEYS_STORAGE_KEY, JSON.stringify(keys));
  } catch {
    /* quota */
  }
}

export function addTrustedKey(key: TrustedKey): readonly TrustedKey[] {
  const next = [...loadTrustedKeys().filter((k) => k.publicKey !== key.publicKey), key];
  saveTrustedKeys(next);
  return next;
}

export function removeTrustedKey(publicKey: string): readonly TrustedKey[] {
  const next = loadTrustedKeys().filter((k) => k.publicKey !== publicKey);
  saveTrustedKeys(next);
  return next;
}

/* ------------------ core verification ------------------ */

/** Verify an Ed25519 signature over the given bundle bytes.
 *  `publicKeyB64` is the SPKI-formatted public key (base64). */
export async function verifySignature(
  bundleBytes: ArrayBuffer,
  signatureB64: string,
  publicKeyB64: string,
): Promise<VerifyResult> {
  try {
    const pubKeyDer = base64ToBytes(publicKeyB64);
    const signature = base64ToBytes(signatureB64);
    const key = await crypto.subtle.importKey(
      "spki",
      pubKeyDer,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify("Ed25519", key, signature, bundleBytes);
    return { ok };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Verify against the trusted-keys list. Passes if the declared public key
 *  matches at least one trusted key AND the signature verifies. */
export async function verifyAgainstTrustedKeys(
  bundleBytes: ArrayBuffer,
  descriptor: SignatureDescriptor,
): Promise<VerifyResult> {
  const trusted = loadTrustedKeys();
  const matching = trusted.find((k) => k.publicKey === descriptor.publicKey);
  if (!matching) {
    return {
      ok: false,
      error: `Publisher key is not in the trusted-keys list. Add it via Plugin Inspector → Trusted keys.`,
    };
  }
  const verify = await verifySignature(bundleBytes, descriptor.signature, descriptor.publicKey);
  return { ...verify, keyId: matching.keyId };
}

function base64ToBytes(b64: string): ArrayBuffer {
  const bin = atob(b64.replace(/\s+/g, ""));
  const buf = new ArrayBuffer(bin.length);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return buf;
}

/** Compute an SRI hash for use in manifest.origin.integrity. */
export async function computeSRI384(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-384", buf);
  const b = new Uint8Array(digest);
  let bin = "";
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return "sha384-" + btoa(bin);
}
