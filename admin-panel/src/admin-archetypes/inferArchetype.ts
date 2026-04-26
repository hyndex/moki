/** Auto-archetype inference.
 *
 *  When a plugin page does not declare an `archetype` on its descriptor,
 *  the shell still tags its container with a sensible `data-archetype` so
 *  every page benefits from the design-system attribute conventions
 *  (analytics, theme overrides, ARIA hints, density propagation).
 *
 *  Plugins that *do* declare an archetype always win. Inference is a
 *  best-effort fallback; it never overrides explicit metadata.
 *
 *  Heuristics are deliberately conservative: only confident matches yield
 *  a non-default archetype. Unknown shapes fall back to "detail-rich",
 *  which is the legacy behaviour (a padded page container). */

import type { ArchetypeId } from "./types";

export interface InferableView {
  /** View id, e.g. "crm.contacts.view". */
  id?: string;
  /** Display title, e.g. "Contacts". */
  title?: string;
  /** Resource id this view binds to (e.g. "crm.contact"). */
  resource?: string;
  /** Underlying view mode (custom / list / form / detail / dashboard / kanban). */
  mode?: string;
  /** Hash route path (e.g. "/crm/territories"). */
  path?: string;
  /** When the page descriptor sets it explicitly, returned as-is. */
  archetype?: ArchetypeId;
  /** When the page descriptor sets it explicitly, returned as-is. */
  fullBleed?: boolean;
}

/* --------- exact mode → archetype map ----------------------------------- */

const MODE_TO_ARCHETYPE: Record<string, ArchetypeId> = {
  list: "smart-list",
  kanban: "kanban",
  dashboard: "dashboard",
  detail: "detail-rich",
  form: "detail-rich",
};

/* --------- heuristic keyword scoring ------------------------------------ */

const KEYWORD_RULES: Array<{
  needles: readonly RegExp[];
  archetype: ArchetypeId;
}> = [
  // Editor / canvas surfaces — always full-bleed.
  {
    needles: [
      /\bslides?\b/i,
      /\bwhiteboard\b/i,
      /\bspreadsheet\b/i,
      /\bcompose\b/i,
      /\beditor\b/i,
      /\bcanvas\b/i,
      /\bplayground\b/i,
    ],
    archetype: "editor-canvas",
  },
  // Map / geo.
  {
    needles: [/\bmap\b/i, /\bgeo\b/i, /\bdispatch\b/i, /\broute(s)?\b/i, /\bterritor(y|ies)\b/i],
    archetype: "map",
  },
  // Calendar / schedule.
  {
    needles: [
      /\bcalendar\b/i,
      /\bschedule\b/i,
      /\bagenda\b/i,
      /\bappointment\b/i,
      /\bbooking\b/i,
      /\bshift(s)?\b/i,
    ],
    archetype: "calendar",
  },
  // Kanban / pipeline / board.
  {
    needles: [
      /\bkanban\b/i,
      /\bpipeline\b/i,
      /\bboard\b/i,
      /\bstages?\b/i,
      /\bworkflow board\b/i,
    ],
    archetype: "kanban",
  },
  // Tree explorer.
  {
    needles: [
      /\btree\b/i,
      /\bhierarchy\b/i,
      /\borg.?chart\b/i,
      /\bbom\b/i,
      /\bbill of materials\b/i,
      /\bchart of accounts\b/i,
      /\bcoa\b/i,
      /\bcategor(y|ies)\b/i,
    ],
    archetype: "tree",
  },
  // Graph / network.
  {
    needles: [
      /\bgraph\b/i,
      /\bnetwork\b/i,
      /\brelations?\b/i,
      /\bconnections?\b/i,
      /\blinks?\b/i,
    ],
    archetype: "graph",
  },
  // Split inbox.
  {
    needles: [
      /\binbox\b/i,
      /\btriage\b/i,
      /\bapprov(als|al queue)\b/i,
      /\breviews?\b/i,
      /\bmail\b/i,
      /\bnotifications?\b/i,
      /\bmessages?\b/i,
      /\banomal(y|ies)\b/i,
      /\bdiscrepanc(y|ies)\b/i,
      /\bdisputes?\b/i,
    ],
    archetype: "split-inbox",
  },
  // Timeline / audit log.
  {
    needles: [
      /\btimeline\b/i,
      /\baudit\b/i,
      /\bhistory\b/i,
      /\bactivity\b/i,
      /\bactivit(y|ies)\b/i,
      /\bdeliveries\b/i,
      /\b(\bsent\b|\breceived\b)\s*log\b/i,
      /\blogs?\b/i,
      /\bevents?\b/i,
      /\bjournals?\b/i,
      /\bmovements?\b/i,
      /\bfeed\b/i,
    ],
    archetype: "timeline",
  },
  // Intelligent Dashboard.
  {
    needles: [
      /\bdashboard\b/i,
      /\boverview\b/i,
      /\bcontrol room\b/i,
      /\bcontrol tower\b/i,
      /\bcockpit\b/i,
      /\bsummary\b/i,
      /\b(health|status) (page|view)\b/i,
      /\b(reports?|analytics|kpis?|metrics)\b/i,
      /\bforecast\b/i,
    ],
    archetype: "dashboard",
  },
  // Smart list (catch-all for /list, plurals, browse).
  {
    needles: [
      /\blist\b/i,
      /\ball [a-z]+s\b/i,
      /\b(people|contacts|accounts|leads|opportunities|orders|invoices|payments|customers|vendors|users|members|files|folders|jobs|tasks|tickets|workflows|automations|rules|templates|skills|agents|runs|datasets|policies|tokens|sessions|tenants|plugins|webhooks|subscriptions|payouts|disputes|coupons|categories|sites|posts|articles|locations|warehouses|items|skus|lots|serials|cycle.?counts|transfers|payslips|runs|reports|projects|cycles|teams|organi[sz]ations)\b/i,
    ],
    archetype: "smart-list",
  },
];

/* --------- public API --------------------------------------------------- */

export interface InferredArchetype {
  archetype: ArchetypeId;
  /** Whether the result was explicitly declared (true) or inferred (false). */
  explicit: boolean;
  /** Whether the page should render full-bleed (skip max-width wrapper). */
  fullBleed: boolean;
}

/** Infer the archetype for a view. Always returns a valid id. */
export function inferArchetype(view: InferableView | null | undefined): InferredArchetype {
  if (!view) return { archetype: "detail-rich", explicit: false, fullBleed: false };

  // Explicit metadata always wins.
  if (view.archetype) {
    return {
      archetype: view.archetype,
      explicit: true,
      fullBleed:
        view.fullBleed === true || view.archetype === "editor-canvas",
    };
  }

  // Underlying mode is a strong signal.
  if (view.mode && MODE_TO_ARCHETYPE[view.mode]) {
    const a = MODE_TO_ARCHETYPE[view.mode];
    return { archetype: a, explicit: false, fullBleed: a === "editor-canvas" };
  }

  // Score by keyword presence in title + id + resource + path.
  const haystack = [view.title, view.id, view.resource, view.mode, view.path]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const rule of KEYWORD_RULES) {
    if (rule.needles.some((rx) => rx.test(haystack))) {
      return {
        archetype: rule.archetype,
        explicit: false,
        fullBleed: rule.archetype === "editor-canvas",
      };
    }
  }

  // Conservative fallback: detail-rich (legacy padded-container behaviour).
  return { archetype: "detail-rich", explicit: false, fullBleed: false };
}
