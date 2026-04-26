/** Self-hosted mail server settings — point the framework at a JMAP
 *  server (Stalwart, Cyrus, Apache James) and generate the DNS records
 *  to publish for inbound mail to land at the new server.
 *
 *  The flow is split into two cards:
 *
 *    1. **Server connection.** URL + admin token + default From address.
 *       A "Probe" button hits the JMAP `.well-known` endpoint with the
 *       supplied credentials and reports `apiUrl` + `accountId` + the
 *       capability list — exactly what the JmapDriver sees on bootstrap.
 *
 *    2. **DNS records.** Domain + DKIM public key generate the MX / SPF
 *       / DKIM / DMARC strings the operator must publish. We deliberately
 *       do NOT push DNS — that's the operator's tool of choice
 *       (Cloudflare API, Route53, terraform). We just produce the values.
 *
 *  Errors at every step are surfaced inline. The Probe button reports
 *  the precise HTTP status + body so configuration mistakes (typo'd
 *  URL, expired token, wrong host) get fixed in seconds rather than
 *  bouncing through CLI logs. */

import * as React from "react";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import { Label } from "@/primitives/Label";
import { Textarea } from "@/primitives/Textarea";
import { cn } from "@/lib/cn";

interface SelfHostedConfig {
  configured: boolean;
  connectionId?: string;
  baseUrl?: string;
  defaultEmail?: string;
  displayName?: string;
}

interface ProbeResult {
  ok: boolean;
  apiUrl?: string;
  hasMailAccount?: boolean;
  capabilities?: string[];
  status?: number;
  body?: string;
  error?: string;
}

interface DnsRecord {
  name: string;
  value: string;
  priority?: number;
}

interface DnsBundle {
  mx: DnsRecord;
  spf: DnsRecord;
  dkim: DnsRecord;
  dmarc: DnsRecord;
  tlsRpt?: DnsRecord;
  mtaSts?: DnsRecord;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = localStorage.getItem("gutu.auth.token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`/api${path}`, { ...init, headers, credentials: "include" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function SelfHostedTab(): React.ReactElement {
  const [config, setConfig] = React.useState<SelfHostedConfig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | undefined>();

  // Form state for the connection card.
  const [baseUrl, setBaseUrl] = React.useState("");
  const [token, setToken] = React.useState("");
  const [defaultEmail, setDefaultEmail] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [probing, setProbing] = React.useState(false);
  const [probe, setProbe] = React.useState<ProbeResult | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<string | undefined>();

  const refreshConfig = React.useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const c = await api<SelfHostedConfig>("/mail/self-hosted");
      setConfig(c);
      if (c.baseUrl) setBaseUrl(c.baseUrl);
      if (c.defaultEmail) setDefaultEmail(c.defaultEmail);
      if (c.displayName) setDisplayName(c.displayName);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshConfig();
  }, [refreshConfig]);

  const handleProbe = async (): Promise<void> => {
    if (!baseUrl || !token) {
      setProbe({ ok: false, error: "URL and token required" });
      return;
    }
    setProbing(true);
    setProbe(null);
    try {
      const r = await api<ProbeResult>("/mail/self-hosted/probe", {
        method: "POST",
        body: JSON.stringify({ baseUrl, token }),
      });
      setProbe(r);
    } catch (err) {
      setProbe({ ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setProbing(false);
    }
  };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setError(undefined);
    try {
      await api("/mail/self-hosted", {
        method: "POST",
        body: JSON.stringify({ baseUrl, token, defaultEmail, displayName: displayName || undefined }),
      });
      setSavedAt(new Date().toLocaleTimeString());
      setToken(""); // never keep the plaintext in memory after save
      await refreshConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="max-w-3xl space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-text-primary">Self-hosted mail server</h2>
        <p className="text-xs text-text-muted leading-relaxed">
          Connect a self-hosted JMAP server (Stalwart, Cyrus, Apache James). The
          framework uses it for inbound and outbound mail through the same
          pipeline that handles Gmail and Outlook accounts.
        </p>
      </div>

      {/* CONNECTION CARD */}
      <div className="rounded-lg border border-border bg-surface-0 shadow-sm">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <div className="text-sm font-semibold text-text-primary">Connection</div>
          {config?.configured && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-success-soft text-success-strong">
              <span className="h-1.5 w-1.5 rounded-full bg-success-strong" aria-hidden /> Configured
            </span>
          )}
        </div>
        <div className="p-4 space-y-3">

        {loading ? (
          <div className="text-xs text-text-muted">Loading…</div>
        ) : (
          <>
            <Field label="JMAP base URL" hint="e.g. https://mail.example.com — no trailing slash">
              <Input
                type="url"
                placeholder="https://mail.example.com"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </Field>

            <Field label="Admin / API token" hint="Stored encrypted at rest. Stalwart issues tokens via its admin UI.">
              <Input
                type="password"
                placeholder={config?.configured ? "••••• (saved — paste a new token to rotate)" : "Bearer …"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Default From address" hint="Used as the envelope sender for outbound mail.">
                <Input
                  type="email"
                  placeholder="hello@example.com"
                  value={defaultEmail}
                  onChange={(e) => setDefaultEmail(e.target.value)}
                />
              </Field>
              <Field label="Display name (optional)">
                <Input
                  type="text"
                  placeholder="Self-hosted (mail.example.com)"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleProbe}
                disabled={probing || !baseUrl || !token}
              >
                {probing ? "Probing…" : "Probe connection"}
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !baseUrl || !token || !defaultEmail}
              >
                {saving ? "Saving…" : config?.configured ? "Update" : "Save"}
              </Button>
              {savedAt && (
                <span className="text-xs text-text-muted">Saved at {savedAt}</span>
              )}
              {error && (
                <span className="text-xs text-danger">{error}</span>
              )}
            </div>

            {probe && (
              <div
                role="status"
                aria-live="polite"
                className={cn(
                  "text-xs rounded-md p-3 space-y-1 border",
                  probe.ok
                    ? "bg-success-soft/60 text-success-strong border-success-strong/20"
                    : "bg-danger-soft/60 text-danger-strong border-danger-strong/20",
                )}
              >
                {probe.ok ? (
                  <>
                    <div className="font-semibold">✓ Reachable</div>
                    <div className="text-text-primary">API URL: <code className="font-mono text-[11px]">{probe.apiUrl}</code></div>
                    <div className="text-text-primary">
                      Mail account: {probe.hasMailAccount ? "yes" : "missing — token might lack mail scope"}
                    </div>
                    <div className="text-text-primary">Capabilities: {(probe.capabilities ?? []).join(", ") || "none"}</div>
                  </>
                ) : (
                  <>
                    <div className="font-semibold">✗ Probe failed</div>
                    {probe.status && <div className="text-text-primary">Status: {probe.status}</div>}
                    {probe.body && <div className="font-mono text-[11px] text-text-primary break-all">{probe.body}</div>}
                    {probe.error && <div className="font-mono text-[11px] text-text-primary break-all">{probe.error}</div>}
                  </>
                )}
              </div>
            )}
          </>
        )}
        </div>
      </div>

      {/* DNS RECORDS CARD */}
      <DnsRecordsCard />
    </section>
  );
}

/** Renders the DKIM-aware DNS bundle generator. Lives in its own
 *  component so the connection card stays small. */
function DnsRecordsCard(): React.ReactElement {
  const [domain, setDomain] = React.useState("");
  const [mailHost, setMailHost] = React.useState("");
  const [dkimSelector, setDkimSelector] = React.useState("default");
  const [dkimPublicKey, setDkimPublicKey] = React.useState("");
  const [dkimKeyType, setDkimKeyType] = React.useState<"rsa" | "ed25519">("rsa");
  const [dmarcPolicy, setDmarcPolicy] = React.useState<"none" | "quarantine" | "reject">("none");
  const [bundle, setBundle] = React.useState<{ bundle: DnsBundle; zoneFile: string } | null>(null);
  const [error, setError] = React.useState<string | undefined>();
  const [building, setBuilding] = React.useState(false);

  const onBuild = async (): Promise<void> => {
    setBuilding(true);
    setError(undefined);
    setBundle(null);
    try {
      const res = await api<{ bundle: DnsBundle; zoneFile: string }>(
        "/mail/self-hosted/dns",
        {
          method: "POST",
          body: JSON.stringify({
            domain,
            mailHost: mailHost || `mail.${domain}`,
            dkimSelector,
            dkimPublicKeyBase64: dkimPublicKey.replace(/\s+/g, ""),
            dkimKeyType,
            dmarcPolicy,
          }),
        },
      );
      setBundle(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface-0 shadow-sm">
      <div className="border-b border-border-subtle px-4 py-3 space-y-1">
        <div className="text-sm font-semibold text-text-primary">DNS records</div>
        <p className="text-xs text-text-muted leading-relaxed">
          Publish these records at your DNS provider so inbound mail at{" "}
          <code className="font-mono text-[11px] px-1 py-0.5 rounded bg-surface-1">@your-domain.com</code>{" "}
          reaches your Stalwart server. The framework only generates the strings — it never touches your DNS zone.
        </p>
      </div>
      <div className="p-4 space-y-3">

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Domain" hint="example.com (no protocol, no trailing slash)">
          <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" />
        </Field>
        <Field label="Mail host" hint="Hostname of the Stalwart server. Defaults to mail.<domain>.">
          <Input value={mailHost} onChange={(e) => setMailHost(e.target.value)} placeholder="mail.example.com" />
        </Field>
        <Field label="DKIM selector">
          <Input value={dkimSelector} onChange={(e) => setDkimSelector(e.target.value)} placeholder="default" />
        </Field>
        <Field label="DKIM key type">
          <select
            value={dkimKeyType}
            onChange={(e) => setDkimKeyType(e.target.value as "rsa" | "ed25519")}
            className="h-8 w-full rounded border border-border bg-surface-0 px-2 text-sm"
          >
            <option value="rsa">RSA (universal)</option>
            <option value="ed25519">Ed25519 (modern, smaller)</option>
          </select>
        </Field>
        <Field label="DMARC policy" hint="Start with 'none' for monitoring; tighten to 'quarantine' then 'reject'.">
          <select
            value={dmarcPolicy}
            onChange={(e) => setDmarcPolicy(e.target.value as "none" | "quarantine" | "reject")}
            className="h-8 w-full rounded border border-border bg-surface-0 px-2 text-sm"
          >
            <option value="none">none (monitor)</option>
            <option value="quarantine">quarantine</option>
            <option value="reject">reject</option>
          </select>
        </Field>
      </div>

      <Field label="DKIM public key (base64)" hint="Get this from Stalwart's admin UI → Domains → DKIM.">
        <Textarea
          value={dkimPublicKey}
          onChange={(e) => setDkimPublicKey(e.target.value)}
          placeholder="MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A…"
          rows={4}
          className="font-mono text-xs"
        />
      </Field>

      <div className="flex items-center gap-2">
        <Button onClick={onBuild} disabled={building || !domain || !dkimPublicKey} size="sm">
          {building ? "Building…" : "Generate records"}
        </Button>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>

      {bundle && (
        <div className="space-y-3 pt-2 border-t border-border-subtle">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Records to publish
            </div>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(bundle.zoneFile).catch(() => undefined)}
              className="text-[11px] text-text-muted hover:text-text-primary transition-colors"
            >
              Copy zone file
            </button>
          </div>
          <DnsRow label="MX" record={bundle.bundle.mx} />
          <DnsRow label="SPF (TXT)" record={bundle.bundle.spf} />
          <DnsRow label="DKIM (TXT)" record={bundle.bundle.dkim} />
          <DnsRow label="DMARC (TXT)" record={bundle.bundle.dmarc} />
          {bundle.bundle.tlsRpt && <DnsRow label="TLSRPT (TXT)" record={bundle.bundle.tlsRpt} />}
          {bundle.bundle.mtaSts && <DnsRow label="MTA-STS (TXT)" record={bundle.bundle.mtaSts} />}
          <details className="text-xs pt-1">
            <summary className="cursor-pointer text-text-muted hover:text-text-primary transition-colors select-none">
              Zone-file format (paste into BIND, PowerDNS)
            </summary>
            <pre className="mt-2 rounded bg-surface-1 p-3 text-[11px] overflow-x-auto whitespace-pre font-mono">
              {bundle.zoneFile}
            </pre>
          </details>
        </div>
      )}
      </div>
    </div>
  );
}

function DnsRow({ label, record }: { label: string; record: DnsRecord }): React.ReactElement {
  const [copied, setCopied] = React.useState(false);
  const copy = (): void => {
    void navigator.clipboard.writeText(record.value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="grid grid-cols-[110px_1fr_auto] gap-3 text-xs items-start group">
      <div className="font-semibold text-text-muted uppercase tracking-wide text-[10px] pt-1">
        {label}
      </div>
      <div className="space-y-0.5 min-w-0">
        <div className="font-mono text-[11px] text-text-primary truncate" title={record.name}>
          {record.name}
          {record.priority !== undefined && (
            <span className="text-text-muted"> (priority {record.priority})</span>
          )}
        </div>
        <div className="font-mono text-[11px] text-text-muted break-all">{record.value}</div>
      </div>
      <button
        type="button"
        onClick={copy}
        title="Copy value"
        className="text-[11px] text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity self-start mt-1 px-1.5 py-0.5 rounded hover:bg-surface-1"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-text-primary">{label}</Label>
      {children}
      {hint && <div className="text-[11px] text-text-muted leading-snug">{hint}</div>}
    </div>
  );
}
