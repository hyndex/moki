/** Minimal TOTP (RFC 6238) implementation for MFA. Uses SHA-1 via Bun's
 *  built-in crypto. Secret is base32-encoded and stored on the user row. */

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function randomSecret(bytes = 20): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return base32Encode(b);
}

export function base32Encode(buf: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Uint8Array {
  const str = s.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of str) {
    const idx = BASE32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

async function hmacSha1(key: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, msg);
  return new Uint8Array(sig);
}

export async function totp(
  secretBase32: string,
  step = 30,
  digits = 6,
  t: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const counter = Math.floor(t / step);
  const msg = new ArrayBuffer(8);
  new DataView(msg).setBigUint64(0, BigInt(counter));
  const key = base32Decode(secretBase32);
  const hmac = await hmacSha1(key, new Uint8Array(msg));
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, "0");
}

/** In-memory replay cache — key: `${secretBase32}:${code}:${step}`.
 *  Entries expire after 120s (covers drift window + a safety margin).
 *  A successful verification marks the triple consumed so the same code
 *  cannot be reused within the drift window. */
const replayCache = new Map<string, number>();

function prunReplayCache(): void {
  const cutoff = Date.now() - 120_000;
  for (const [k, v] of replayCache) if (v < cutoff) replayCache.delete(k);
}

export async function verifyTotp(
  secretBase32: string,
  code: string,
  drift = 1,
): Promise<boolean> {
  prunReplayCache();
  const trimmed = code.trim();
  const now = Math.floor(Date.now() / 1000);
  for (let i = -drift; i <= drift; i++) {
    const step = Math.floor((now + i * 30) / 30);
    const expected = await totp(secretBase32, 30, 6, now + i * 30);
    if (expected === trimmed) {
      const key = `${secretBase32}:${trimmed}:${step}`;
      if (replayCache.has(key)) return false; // already consumed
      replayCache.set(key, Date.now());
      return true;
    }
  }
  return false;
}

/** otpauth:// URL — pasted into an authenticator app or rendered as a QR. */
export function otpauthUrl(issuer: string, account: string, secret: string): string {
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
