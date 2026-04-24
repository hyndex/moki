import { db } from "../db";
import { bulkInsert } from "../lib/query";

/** Backend seed for extended Support resources. Idempotent. */

const AGENTS = ["Sam Hopper", "Alex Knuth", "Taylor Turing", "Jordan Hamilton", "Casey Pappas"];
const CHANNELS = ["email", "chat", "phone", "portal", "social", "api"];
const CATEGORIES = ["bug", "question", "billing", "feature", "account", "integration"];
const FIRST = ["Ada", "Grace", "Linus", "Guido", "Alan", "Donald", "Katherine", "Barbara", "Margaret"];
const LAST = ["Lovelace", "Hopper", "Torvalds", "van Rossum", "Turing", "Knuth", "Johnson", "Liskov", "Hamilton"];

const pick = <T>(arr: readonly T[], i: number): T => arr[i % arr.length]!;
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
const code = (p: string, i: number, pad = 4) => `${p}-${String(1000 + i).padStart(pad, "0")}`;
const personName = (i: number) => `${pick(FIRST, i)} ${pick(LAST, i + 2)}`;

const count = (r: string) =>
  (db.prepare("SELECT COUNT(*) AS c FROM records WHERE resource = ?").get(r) as { c: number }).c;
const seedIf = (r: string, rows: Record<string, unknown>[]) =>
  count(r) > 0 ? 0 : bulkInsert(r, rows);

function tickets(n: number): Record<string, unknown>[] {
  return Array.from({ length: n }, (_, i) => {
    const created = daysAgo(i * 0.6);
    const c = Date.parse(created);
    const isResolved = i % 4 === 2 || i % 4 === 3;
    const firstResponseMin = 15 + ((i * 37) % 720);
    const resolvedHrs = 2 + ((i * 7) % 72);
    const slaHrs = 24;
    return {
      id: `sup_tk_${i + 1}`,
      code: code("SUP", i, 6),
      subject: pick([
        "Cannot log in", "Missing invoice", "Feature request: CSV export",
        "Slow report loading", "Billing question", "Integration webhook failing",
        "Password reset not working", "Exports truncated", "API 429 errors",
        "Permission denied on dashboard", "Mobile app crash", "Data import stuck",
      ], i),
      requester: personName(i),
      requesterEmail: `user+${i}@example.com`,
      customer: pick(["Acme Corp", "Globex", "Initech", "Hooli", "Pied Piper", "Dunder Mifflin"], i),
      assignee: pick(AGENTS, i),
      team: pick(["tier-1", "tier-1", "tier-2", "engineering", "billing", "success"], i),
      channel: pick(CHANNELS, i),
      category: pick(CATEGORIES, i),
      priority: pick(["low", "normal", "normal", "high", "urgent"], i),
      status: pick(["open", "in_progress", "resolved", "closed"], i),
      slaPolicy: pick(["Standard", "Premium", "Enterprise"], i),
      slaDueAt: new Date(c + slaHrs * 3_600_000).toISOString(),
      slaBreached: !isResolved && (Date.now() - c) / 3_600_000 > slaHrs,
      slaAtRisk: !isResolved && (Date.now() - c) / 3_600_000 > slaHrs * 0.75 && (Date.now() - c) / 3_600_000 <= slaHrs,
      createdAt: created,
      firstResponseAt: new Date(c + firstResponseMin * 60_000).toISOString(),
      resolvedAt: isResolved ? new Date(c + resolvedHrs * 3_600_000).toISOString() : "",
      updatedAt: daysAgo(i * 0.5),
      messagesCount: 1 + (i % 12),
      tags: i % 5 === 0 ? ["vip"] : i % 7 === 0 ? ["escalated"] : [],
      description: "",
      resolutionNotes: isResolved ? "Issue resolved after rolling back recent deployment." : "",
    };
  });
}

function slaPolicies(): Record<string, unknown>[] {
  const names = ["Standard", "Premium", "Enterprise", "Dev-Tier", "Trial", "Internal"];
  const descs = [
    "Default tier — small customers", "Premium plan SLA", "Top-tier enterprise SLA",
    "Dev-plan SLA", "Trial accounts SLA", "Internal teams SLA",
  ];
  const first = [24, 4, 1, 48, 72, 8];
  const res = [72, 24, 8, 120, 168, 48];
  const pri = ["normal", "high", "urgent", "low", "low", "normal"];
  return names.map((name, i) => ({
    id: `sup_sla_${i + 1}`,
    name,
    description: descs[i],
    firstResponseHours: first[i],
    resolutionHours: res[i],
    priority: pri[i],
    businessHoursOnly: i % 2 === 0,
    active: true,
  }));
}

function serviceContracts(n: number): Record<string, unknown>[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `sup_sc_${i + 1}`,
    code: code("SC", i, 6),
    customer: pick(["Acme Corp", "Globex", "Initech", "Hooli", "Pied Piper"], i),
    slaPolicy: pick(["Standard", "Premium", "Enterprise"], i),
    startAt: daysAgo(365 - i * 20),
    endAt: daysFromNow(365 - i * 20),
    renewalAt: daysFromNow(335 - i * 20),
    status: pick(["active", "active", "active", "expiring-soon", "renewed"], i),
    valueAnnual: 10_000 + ((i * 7537) % 200_000),
    owner: pick(AGENTS, i),
  }));
}

function warrantyClaims(n: number): Record<string, unknown>[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `sup_wc_${i + 1}`,
    code: code("WC", i, 5),
    product: pick(["Widget A", "Gizmo B", "Part C", "Motor O", "Sensor P"], i),
    serial: `SN-${String(10000 + i * 37).slice(-5)}`,
    customer: pick(["Acme Corp", "Globex", "Initech", "Hooli"], i),
    claimedAt: daysAgo(i * 5),
    reportedIssue: pick(["Stopped working", "Noisy", "Intermittent failures", "Overheating", "Physical damage"], i),
    repairCost: (i * 37) % 600 + 30,
    status: pick(["resolved", "in-progress", "pending", "resolved", "rejected"], i),
  }));
}

function kbArticles(n: number): Record<string, unknown>[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `sup_kb_${i + 1}`,
    title: pick([
      "Resetting your password", "Setting up SSO", "Importing CSV files",
      "Understanding invoices", "API rate limits", "Two-factor authentication",
      "Migrating from v1", "Webhook event reference", "Data retention policy",
      "Exporting your data",
    ], i),
    slug: pick([
      "reset-password", "sso-setup", "import-csv", "understanding-invoices",
      "rate-limits", "2fa", "migrate-v1", "webhook-reference", "data-retention", "export-data",
    ], i),
    category: pick(["getting-started", "troubleshooting", "api", "billing", "security"], i),
    author: pick(AGENTS, i),
    views: 100 + ((i * 317) % 10_000),
    helpfulYes: 50 + (i * 13) % 400,
    helpfulNo: 5 + (i * 7) % 50,
    status: pick(["published", "published", "published", "draft", "archived"], i),
    updatedAt: daysAgo(i * 3),
    body: "Full article body…",
  }));
}

function cannedResponses(n: number): Record<string, unknown>[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `sup_cr_${i + 1}`,
    name: pick([
      "Ack — looking into it", "Ack — escalating", "Request more info",
      "Request screenshot", "Send API docs link", "Send billing portal",
      "Close ticket — resolved", "Close ticket — dupe", "Ask for CSAT",
      "Apology for delay", "Scheduled maintenance reply", "Follow-up after 7d",
    ], i),
    shortcut: `/${pick(["ack", "esc", "info", "ss", "api", "bill", "res", "dupe", "csat", "apo", "maint", "fu7"], i)}`,
    category: pick(CATEGORIES, i),
    usageCount: 20 + ((i * 29) % 500),
    active: i !== 11,
    body: "Hi {{requester.firstName}}, thanks for reaching out…",
  }));
}

function csatResponses(n: number): Record<string, unknown>[] {
  return Array.from({ length: n }, (_, i) => {
    const score = pick([5, 5, 5, 4, 4, 3, 2, 1], i);
    return {
      id: `sup_csat_${i + 1}`,
      ticketCode: code("SUP", i % 50, 6),
      customer: pick(["Acme Corp", "Globex", "Initech", "Hooli", "Pied Piper"], i),
      agent: pick(AGENTS, i),
      score,
      sentiment: score >= 4 ? "positive" : score === 3 ? "neutral" : "negative",
      submittedAt: daysAgo(i * 0.5),
      comment: pick([
        "Resolved quickly, thanks!", "Very helpful agent.", "Took longer than expected.",
        "Great support as always.", "Response was confusing.", "No update for days.",
      ], i),
    };
  });
}

function escalations(n: number): Record<string, unknown>[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `sup_esc_${i + 1}`,
    code: code("ESC", i, 5),
    ticketCode: code("SUP", i % 50, 6),
    fromTeam: pick(["tier-1", "tier-2", "billing"], i),
    toTeam: pick(["tier-2", "engineering", "success"], i),
    reason: pick(["sla-at-risk", "vip", "technical", "billing", "legal"], i),
    escalatedBy: pick(AGENTS, i),
    escalatedAt: daysAgo(i * 0.8),
    resolvedAt: i % 2 === 0 ? daysAgo(i * 0.3) : "",
    status: pick(["resolved", "resolved", "in-progress", "pending"], i),
  }));
}

export function seedSupportExtended(): Record<string, number> {
  const out: Record<string, number> = {};
  out["support-service.ticket"] = seedIf("support-service.ticket", tickets(50));
  out["support-service.sla-policy"] = seedIf("support-service.sla-policy", slaPolicies());
  out["support-service.service-contract"] = seedIf("support-service.service-contract", serviceContracts(14));
  out["support-service.warranty-claim"] = seedIf("support-service.warranty-claim", warrantyClaims(16));
  out["support-service.kb-article"] = seedIf("support-service.kb-article", kbArticles(22));
  out["support-service.canned-response"] = seedIf("support-service.canned-response", cannedResponses(12));
  out["support-service.csat-response"] = seedIf("support-service.csat-response", csatResponses(40));
  out["support-service.escalation"] = seedIf("support-service.escalation", escalations(14));
  return out;
}
