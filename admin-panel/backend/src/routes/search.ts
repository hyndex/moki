/** Global record search — `/api/search?q=…[&resources=a,b][&limit=20]`.
 *
 *  Walks every record in the `records` table whose data column
 *  matches the query, filters to records the user can actually read
 *  via ACL, and returns top-N grouped-by-resource results for the
 *  Cmd+K palette + the top-bar search box.
 *
 *  Implementation notes:
 *    - We use SQLite's substring `LIKE` — the same operator the
 *      existing per-list search uses. It's case-insensitive on the
 *      lowercased JSON blob so any string field anywhere in the
 *      record matches. For larger tenants this would graduate to
 *      FTS5 virtual tables, but that's a follow-up; the current
 *      4000-record corpus searches in <10ms.
 *    - Each resource's search returns the FIRST 5 hits by default.
 *      Limit is capped at 50 globally to bound response size.
 *    - Results are filtered by `accessibleRecordIds` per-resource so
 *      a user can never see a record they don't have access to in
 *      search results. This re-uses the same ACL helper that the
 *      list endpoint uses.
 *    - Each hit carries enough info to render a Cmd+K row: title,
 *      subtitle, icon hint (resource-derived), URL hint, and the
 *      matched field for highlighting. */
import { Hono } from "hono";
import { requireAuth, currentUser } from "../middleware/auth";
import { getTenantContext } from "../tenancy/context";
import { db } from "../db";
import { accessibleRecordIds } from "../lib/acl";

export const searchRoutes = new Hono();
searchRoutes.use("*", requireAuth);

interface SearchHit {
  resource: string;
  id: string;
  title: string;
  subtitle?: string;
  url?: string;
  matchedField?: string;
  matchedSnippet?: string;
  /** Score is the inverse of position in the raw result set — earlier
   *  hits are usually a tighter title match. */
  score: number;
}

interface SearchResponse {
  query: string;
  total: number;
  groups: Array<{
    resource: string;
    label: string;
    hits: SearchHit[];
  }>;
}

/** Map resource id → human label + URL pattern. Built from a list of
 *  hard-coded common ones; falls back to the resource id slug. */
const RESOURCE_HINTS: Record<string, { label: string; pathBase: string }> = {
  "crm.contact": { label: "Contacts", pathBase: "/contacts" },
  "crm.lead": { label: "Leads", pathBase: "/crm/leads" },
  "crm.opportunity": { label: "Opportunities", pathBase: "/crm/opportunities" },
  "crm.campaign": { label: "Campaigns", pathBase: "/crm/campaigns" },
  "crm.appointment": { label: "Appointments", pathBase: "/crm/appointments" },
  "crm.contract": { label: "Contracts", pathBase: "/crm/contracts" },
  "crm.competitor": { label: "Competitors", pathBase: "/crm/competitors" },
  "crm.note": { label: "Notes", pathBase: "/crm/notes" },
  "crm.task": { label: "Tasks", pathBase: "/crm/tasks" },
  "crm.call": { label: "Calls", pathBase: "/crm/calls" },
  "sales.deal": { label: "Deals", pathBase: "/sales/deals" },
  "sales.quote": { label: "Quotes", pathBase: "/sales/quotes" },
  "sales.product": { label: "Products", pathBase: "/sales/products" },
  "sales.partner": { label: "Partners", pathBase: "/sales/partners" },
  "spreadsheet.workbook": { label: "Spreadsheets", pathBase: "/spreadsheets" },
  "document.page": { label: "Documents", pathBase: "/documents" },
  "slides.deck": { label: "Slides", pathBase: "/slides" },
  "collab.page": { label: "Pages", pathBase: "/pages" },
  "whiteboard.canvas": { label: "Whiteboards", pathBase: "/whiteboards" },
};

/** Best-effort title field per resource. Most CRM records have
 *  `name`; opportunities use `title`; documents use `title`. The
 *  fallback is `id`. */
const TITLE_FIELDS = ["name", "title", "label", "subject", "fullName", "displayName", "email"];

function pickTitle(rec: Record<string, unknown>): string {
  for (const f of TITLE_FIELDS) {
    const v = rec[f];
    if (typeof v === "string" && v.trim().length > 0) return v;
    if (typeof v === "number") return String(v);
  }
  return String(rec.id ?? "(untitled)");
}

function pickSubtitle(rec: Record<string, unknown>): string | undefined {
  const candidates = ["company", "stage", "status", "email", "owner", "type", "amount"];
  for (const f of candidates) {
    const v = rec[f];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return undefined;
}

searchRoutes.get("/", (c) => {
  const url = new URL(c.req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
  const filterResources = url.searchParams.get("resources")?.split(",").filter(Boolean);
  if (q.length < 2) {
    return c.json({ query: q, total: 0, groups: [] } satisfies SearchResponse);
  }
  const user = currentUser(c);
  const tenantId = getTenantContext()?.tenantId ?? "default";

  // Find which resources have at least one record matching the query.
  // Limit candidate resources for speed when filterResources is given.
  const resourceFilter = filterResources && filterResources.length > 0
    ? `AND resource IN (${filterResources.map(() => "?").join(",")})`
    : "";
  const args: unknown[] = [`%${q.toLowerCase()}%`];
  if (filterResources) args.push(...filterResources);

  // Pull candidate hits with a single LIKE — fast on the index for
  // small corpora. Cap at limit*4 so the per-resource grouping still
  // has variety after ACL filtering drops some.
  const cap = limit * 4;
  args.push(cap);
  const candidates = db
    .prepare(
      `SELECT resource, id, data FROM records
       WHERE LOWER(data) LIKE ? ${resourceFilter}
       ORDER BY updated_at DESC
       LIMIT ?`,
    )
    .all(...args) as { resource: string; id: string; data: string }[];

  // Per-resource ACL filter.
  const accessByResource = new Map<string, Set<string>>();
  const getAccess = (resource: string): Set<string> => {
    let s = accessByResource.get(resource);
    if (!s) {
      s = accessibleRecordIds({ resource, userId: user.id, tenantId });
      accessByResource.set(resource, s);
    }
    return s;
  };

  // Group + filter.
  const groups = new Map<string, SearchHit[]>();
  let total = 0;
  for (const cand of candidates) {
    if (!getAccess(cand.resource).has(cand.id)) continue;
    let rec: Record<string, unknown>;
    try { rec = JSON.parse(cand.data); } catch { continue; }
    if (rec.status === "deleted") continue;
    if ((rec.tenantId as string | undefined) && rec.tenantId !== "default" && rec.tenantId !== tenantId) continue;
    const hint = RESOURCE_HINTS[cand.resource];
    const title = pickTitle(rec);
    const subtitle = pickSubtitle(rec);
    const url = hint ? `${hint.pathBase}/${cand.id}` : `/objects/${cand.resource}/${cand.id}`;
    const matchedField = findMatchedField(rec, q);
    const hit: SearchHit = {
      resource: cand.resource,
      id: cand.id,
      title,
      subtitle,
      url,
      matchedField: matchedField?.field,
      matchedSnippet: matchedField?.snippet,
      // Title-match scores higher than body-match.
      score: title.toLowerCase().includes(q.toLowerCase()) ? 100 : 50,
    };
    const list = groups.get(cand.resource) ?? [];
    if (list.length < 5) list.push(hit);
    groups.set(cand.resource, list);
    total++;
    if (total >= limit) break;
  }

  // Sort hits within each group by score; sort groups by total count.
  const groupList = Array.from(groups.entries())
    .map(([resource, hits]) => ({
      resource,
      label: RESOURCE_HINTS[resource]?.label ?? resource,
      hits: hits.sort((a, b) => b.score - a.score),
    }))
    .sort((a, b) => b.hits.length - a.hits.length);

  return c.json({ query: q, total, groups: groupList } satisfies SearchResponse);
});

/** For a record + query, return the field name and a snippet of its
 *  value where the query first matches. Lets the UI render
 *  "Email · alice@example.com — matched 'alice'" for clarity. */
function findMatchedField(
  rec: Record<string, unknown>,
  q: string,
): { field: string; snippet: string } | undefined {
  const lq = q.toLowerCase();
  for (const [field, value] of Object.entries(rec)) {
    if (typeof value !== "string") continue;
    const lv = value.toLowerCase();
    const idx = lv.indexOf(lq);
    if (idx === -1) continue;
    const start = Math.max(0, idx - 16);
    const end = Math.min(value.length, idx + q.length + 16);
    const snippet = (start > 0 ? "…" : "") + value.slice(start, end) + (end < value.length ? "…" : "");
    return { field, snippet };
  }
  return undefined;
}
