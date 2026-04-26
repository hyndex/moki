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
/** Trusted keys registry — populated from localStorage + admin UI. */
const TRUSTED_KEYS_STORAGE_KEY = "gutu.plugin.trustedKeys";
export function loadTrustedKeys() {
    try {
        const raw = localStorage.getItem(TRUSTED_KEYS_STORAGE_KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
export function saveTrustedKeys(keys) {
    try {
        localStorage.setItem(TRUSTED_KEYS_STORAGE_KEY, JSON.stringify(keys));
    }
    catch {
        /* quota */
    }
}
export function addTrustedKey(key) {
    const next = [...loadTrustedKeys().filter((k) => k.publicKey !== key.publicKey), key];
    saveTrustedKeys(next);
    return next;
}
export function removeTrustedKey(publicKey) {
    const next = loadTrustedKeys().filter((k) => k.publicKey !== publicKey);
    saveTrustedKeys(next);
    return next;
}
/* ------------------ core verification ------------------ */
/** Verify an Ed25519 signature over the given bundle bytes.
 *  `publicKeyB64` is the SPKI-formatted public key (base64). */
export async function verifySignature(bundleBytes, signatureB64, publicKeyB64) {
    try {
        const pubKeyDer = base64ToBytes(publicKeyB64);
        const signature = base64ToBytes(signatureB64);
        const key = await crypto.subtle.importKey("spki", pubKeyDer, { name: "Ed25519" }, false, ["verify"]);
        const ok = await crypto.subtle.verify("Ed25519", key, signature, bundleBytes);
        return { ok };
    }
    catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}
/** Verify against the trusted-keys list. Passes if the declared public key
 *  matches at least one trusted key AND the signature verifies. */
export async function verifyAgainstTrustedKeys(bundleBytes, descriptor) {
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
function base64ToBytes(b64) {
    const bin = atob(b64.replace(/\s+/g, ""));
    const buf = new ArrayBuffer(bin.length);
    const arr = new Uint8Array(buf);
    for (let i = 0; i < bin.length; i++)
        arr[i] = bin.charCodeAt(i);
    return buf;
}
/** Compute an SRI hash for use in manifest.origin.integrity. */
export async function computeSRI384(buf) {
    const digest = await crypto.subtle.digest("SHA-384", buf);
    const b = new Uint8Array(digest);
    let bin = "";
    for (let i = 0; i < b.length; i++)
        bin += String.fromCharCode(b[i]);
    return "sha384-" + btoa(bin);
}
