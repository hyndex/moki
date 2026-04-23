/** RFC-4122-ish v4 UUID — Bun exposes crypto.randomUUID natively. */
export function uuid(): string {
  return crypto.randomUUID();
}

/** Token for session cookies — 32 bytes, base64url-encoded. */
export function token(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Buffer.from(b)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
