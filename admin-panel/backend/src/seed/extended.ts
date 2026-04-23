import { bulkInsert } from "../lib/query";
import {
  COMPANIES,
  REP_NAMES,
  code,
  daysAgo,
  hoursAgo,
  money,
  personName,
  pick,
} from "./helpers";

/** Resources introduced to back formerly-hardcoded pages. */
export function seedExtended(): Record<string, number> {
  const counts: Record<string, number> = {};
  const put = <T extends Record<string, unknown>>(r: string, rows: T[]) => {
    counts[r] = bulkInsert(r, rows);
  };

  /* Platform configuration -------------------------------------------------
     Simple key/value store used by pages that previously hardcoded values. */
  put("platform.config", [
    {
      id: "fiscal",
      key: "fiscal",
      value: {
        quarter: "Q2 FY26",
        year: 2026,
        startDate: "2026-04-01",
        endDate: "2026-06-30",
      },
    },
    {
      id: "sales-targets",
      key: "sales-targets",
      value: {
        repQuotaQuarter: 120_000,
        companyQuarter: 1_800_000,
        annual: 7_200_000,
      },
    },
    {
      id: "plan",
      key: "plan",
      value: {
        name: "Pro",
        pricePerMonth: 240,
        seats: 10,
        includedRecords: 100_000,
        includedAiTokens: 5_000_000,
      },
    },
  ]);

  /* Sales reps — replaces the hardcoded REP_NAMES constant. */
  put(
    "sales.rep",
    REP_NAMES.map((rep, i) => ({
      id: `rep_${i + 1}`,
      name: rep,
      email: rep.toLowerCase().replace(/\s+/g, ".") + "@gutu.dev",
      territory: pick(["North America", "EMEA", "APAC", "LATAM"], i),
      quotaQuarter: 120_000,
      startDate: daysAgo(300 + i * 30),
      active: true,
    })),
  );

  /* Deal line items — ties to sales.deal ids dl_500..dl_527. */
  const PRODUCTS = [
    { name: "Seat license", unit: 480, kind: "license" },
    { name: "Onboarding package", unit: 4000, kind: "services" },
    { name: "Premium support", unit: 12_000, kind: "support" },
    { name: "Training hours", unit: 240, kind: "services" },
    { name: "Custom integration", unit: 18_000, kind: "services" },
  ];
  const lineItems: Record<string, unknown>[] = [];
  for (let i = 0; i < 28; i++) {
    const dealId = `dl_${500 + i}`;
    // 2–4 line items per deal
    const n = 2 + (i % 3);
    for (let j = 0; j < n; j++) {
      const p = pick(PRODUCTS, i + j);
      lineItems.push({
        id: `li_${i}_${j}`,
        dealId,
        name: p.name,
        kind: p.kind,
        quantity: j === 0 ? 10 + (i % 40) : 1 + (j % 3),
        unitPrice: p.unit,
        total: (j === 0 ? 10 + (i % 40) : 1 + (j % 3)) * p.unit,
      });
    }
  }
  put("sales.deal-line-item", lineItems);

  /* Deal stage-change events — drives the "probability sparkline". */
  const dealEvents: Record<string, unknown>[] = [];
  const stages = ["qualify", "proposal", "negotiate", "won"];
  for (let i = 0; i < 28; i++) {
    const dealId = `dl_${500 + i}`;
    for (let s = 0; s < stages.length; s++) {
      if (s > (i % stages.length)) break;
      dealEvents.push({
        id: `de_${i}_${s}`,
        dealId,
        stage: stages[s],
        probability: [0.1, 0.35, 0.65, 1.0][s],
        occurredAt: daysAgo(60 - s * 15 - (i % 10)),
      });
    }
  }
  put("sales.deal-event", dealEvents);

  /* Contact notes — real persistent notes (distinct from crm.activity). */
  const notes: Record<string, unknown>[] = [];
  for (let i = 0; i < 30; i++) {
    notes.push({
      id: `note_${i + 1}`,
      contactId: `ct_${100 + (i % 44)}`,
      author: pick(REP_NAMES, i),
      body: pick(
        [
          "Wants annual billing with multi-region deployment.",
          "Evaluating against three competitors, decision in 30 days.",
          "Mentioned upcoming budget cycle — revisit next quarter.",
          "Security questionnaire sent, expecting reply this week.",
          "Asked for a custom SLA around incident response.",
        ],
        i,
      ),
      createdAt: daysAgo(i * 1.7),
    });
  }
  put("crm.note", notes);

  /* Platform metrics — time-series + snapshots used by the Home page. */
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  put("platform.metric", [
    {
      id: "mrr",
      key: "mrr",
      label: "MRR",
      unit: "USD",
      latest: 112_480,
      trendPct: 8,
      series: months.map((m, i) => ({ x: m, y: [42, 48, 55, 60, 68, 72, 81, 84, 92, 98, 104, 112][i] * 1000 })),
    },
    {
      id: "active-users",
      key: "active-users",
      label: "Active users",
      unit: "count",
      latest: 8492,
      trendPct: 2,
    },
    {
      id: "pipeline-value",
      key: "pipeline-value",
      label: "Pipeline",
      unit: "USD",
      latest: 1_420_000,
      trendPct: 14,
    },
    {
      id: "system-health",
      key: "system-health",
      label: "System health",
      unit: "status",
      services: [
        { name: "API", status: "ok", latency: [42, 38, 41, 39, 37, 40, 42, 44, 43, 41] },
        { name: "Background jobs", status: "ok", latency: [120, 118, 124, 115, 122, 119, 130, 128, 125, 121] },
        { name: "AI gateway", status: "warn", latency: [210, 220, 230, 260, 280, 310, 290, 250, 240, 220] },
        { name: "Integrations", status: "ok", latency: [88, 92, 90, 89, 91, 94, 93, 90, 88, 87] },
      ],
    },
    {
      id: "plugin-activity-24h",
      key: "plugin-activity-24h",
      label: "Plugin activity (24h)",
      unit: "count",
      series: [
        { x: "CRM", y: 1280 },
        { x: "Sales", y: 940 },
        { x: "Support", y: 820 },
        { x: "Booking", y: 640 },
        { x: "Accounting", y: 510 },
        { x: "AI", y: 410 },
        { x: "Inventory", y: 320 },
        { x: "HR", y: 210 },
      ],
    },
  ]);

  /* Booking KPIs — for the dashboard page. */
  put("booking.kpi", [
    {
      id: "daily",
      today: 12,
      yesterday: 8,
      week: 68,
      weekPrev: 60,
      monthRevenue: 14_250,
      monthRevenuePrev: 13_180,
      cancellations: 3,
      cancellationRate: 0.009,
    },
  ]);

  /* POS shifts — historical end-of-day register totals. */
  const shifts: Record<string, unknown>[] = [];
  for (let i = 0; i < 14; i++) {
    shifts.push({
      id: `shift_${i + 1}`,
      terminal: code("POS", i % 4, 4),
      openedAt: daysAgo(i),
      closedAt: daysAgo(i, ),
      sales: money(i, 2000, 6000),
      transactions: 80 + ((i * 7) % 60),
      refunds: money(i, 0, 200),
      operator: personName(i),
      byHour: Array.from({ length: 10 }, (_, h) => ({
        hour: 9 + h,
        sales: 120 + ((h * 61 + i * 13) % 520),
      })),
      paymentMix: [
        { method: "card", amount: 3200 + i * 10 },
        { method: "cash", amount: 680 },
        { method: "gift", amount: 240 },
        { method: "other", amount: 164 },
      ],
    });
  }
  put("pos.shift", shifts);

  /* HR headcount snapshots — per department per month. */
  const depts = ["Engineering", "Sales", "Support", "Operations", "HR"];
  const headcount: Record<string, unknown>[] = [];
  for (let m = 0; m < 12; m++) {
    headcount.push({
      id: `hc_${m + 1}`,
      month: months[m],
      netHires: 1 + ((m * 2) % 6),
      total: 48 + m,
      byDepartment: depts.map((d, i) => ({
        department: d,
        count: [24, 10, 8, 7, 5][i] + ((m + i) % 3),
      })),
    });
  }
  put("hr.headcount", headcount);

  /* Treasury snapshots. */
  const treasurySnapshots: Record<string, unknown>[] = [];
  for (let m = 0; m < 12; m++) {
    treasurySnapshots.push({
      id: `treasury_${m + 1}`,
      month: months[m],
      totalUsd: 1_200_000 + ((m * 53_000) % 640_000),
      byAccount: [
        { account: "Ops USD", amount: 700_000 + m * 10_000 },
        { account: "Reserve EUR", amount: 420_000 },
        { account: "Payroll USD", amount: 120_000 },
      ],
    });
  }
  put("treasury.snapshot", treasurySnapshots);

  /* Analytics cohort snapshot. */
  const cohorts = ["Nov", "Dec", "Jan", "Feb", "Mar"];
  put(
    "analytics.cohort",
    cohorts.map((c, ci) => ({
      id: `cohort_${c}`,
      cohort: c,
      sizeOnDayZero: 120 + ci * 15,
      monthly: [100, 92, 88, 85, 82, 80].map((base, mi) => ({
        monthOffset: mi,
        retentionPct: Math.max(50, base - ci * 3 - mi),
      })),
    })),
  );

  /* Analytics: revenue trajectory + revenue mix. */
  put("analytics.arr", [
    {
      id: "arr-trajectory",
      series: months.map((m, i) => ({
        x: m,
        y: [1800, 1880, 1940, 2020, 2110, 2190, 2280, 2360, 2450, 2560, 2680, 2800][i] * 1000,
      })),
      latest: 2_800_000,
      yoyPct: 18,
    },
  ]);
  put("analytics.revenue-mix", [
    { id: "new-logos", segment: "New logos", value: 1_840_000 },
    { id: "expansion", segment: "Expansion", value: 480_000 },
    { id: "services", segment: "Services", value: 180_000 },
    { id: "other", segment: "Other", value: 80_000 },
  ]);

  /* Sales lost-reasons distribution. */
  put("sales.lost-reason", [
    { id: "lr_price", reason: "Price", count: 28 },
    { id: "lr_comp", reason: "Competitor", count: 18 },
    { id: "lr_timing", reason: "Timing", count: 14 },
    { id: "lr_nodec", reason: "No decision", count: 10 },
    { id: "lr_other", reason: "Other", count: 8 },
  ]);

  /* Sales stage velocity (avg days per stage). */
  put("sales.stage-velocity", [
    { id: "v_qualify", stage: "Qualify", avgDays: 8 },
    { id: "v_proposal", stage: "Proposal", avgDays: 14 },
    { id: "v_negotiate", stage: "Negotiate", avgDays: 12 },
    { id: "v_close", stage: "Close", avgDays: 6 },
  ]);

  /* AI eval case results — per-case drill-down for run detail. */
  const evalCases: Record<string, unknown>[] = [];
  const runCategories = ["Code", "Math", "Reasoning", "Summarize", "Refusal", "Tone"];
  for (let r = 0; r < 20; r++) {
    const runId = `evalrun_${r + 1}`;
    for (let i = 0; i < 6; i++) {
      evalCases.push({
        id: `evc_${r}_${i}`,
        runId,
        name: pick(
          [
            "hello-world",
            "three-sum",
            "leet_bracket",
            "policy_2",
            "summarize-memo",
            "friendly-tone",
            "sudoku_14",
            "citation_check",
          ],
          i + r,
        ),
        category: pick(runCategories, i),
        pass: (i + r) % 5 !== 3,
        latencyMs: 240 + ((i * 61 + r * 31) % 800),
      });
    }
  }
  put("ai-evals.case", evalCases);

  /* Automation step traces. */
  const autoSteps: Record<string, unknown>[] = [];
  for (let r = 0; r < 30; r++) {
    const runId = `arun_${r + 1}`;
    const steps = [
      { step: "Trigger: invoice.overdue", ms: 0 },
      { step: "Resolve customer", ms: 120 },
      { step: "Render email template", ms: 42 },
      { step: "Deliver via SendGrid", ms: 880 },
    ];
    steps.forEach((s, i) => {
      autoSteps.push({
        id: `astep_${r}_${i}`,
        runId,
        order: i,
        step: s.step,
        durationMs: s.ms,
        ok: (r + i) % 7 !== 6,
      });
    });
  }
  put("automation.step", autoSteps);

  /* Integration ping history — surfaces on status page. */
  const pings: Record<string, unknown>[] = [];
  const connectors = ["slack", "stripe", "hubspot", "github", "salesforce"];
  for (let c = 0; c < connectors.length; c++) {
    for (let i = 0; i < 10; i++) {
      pings.push({
        id: `ping_${c}_${i}`,
        connector: connectors[c],
        status: c === 4 && i === 0 ? "down" : c === 2 ? "warning" : "ok",
        latencyMs: 80 + ((i * 31 + c * 17) % 400),
        pingedAt: hoursAgo(i * 2 + c),
      });
    }
  }
  put("integration.ping", pings);

  /* Inventory low-stock alerts — precomputed view. */
  const alerts: Record<string, unknown>[] = [];
  for (let i = 0; i < 10; i++) {
    alerts.push({
      id: `alert_${i + 1}`,
      sku: `SKU-${String(1100 + i).padStart(5, "0")}`,
      name: `${["Widget A", "Gizmo B", "Part C", "Bracket D", "Screw E"][i % 5]} #${i}`,
      onHand: 2 + (i % 8),
      reorderPoint: 20 + (i % 10),
      daysToStockout: 3 + (i % 7),
      trend: Array.from({ length: 12 }, (_, j) => 30 - j + (i % 3)),
      severity: i < 3 ? "high" : i < 7 ? "medium" : "low",
    });
  }
  put("inventory.alert", alerts);

  /* Onboarding steps — for the wizard. */
  put("platform.onboarding-step", [
    { id: "step_1", order: 1, title: "Workspace created", description: "Your Gutu workspace is live.", done: true },
    { id: "step_2", order: 2, title: "Invite your team", description: "Share access with colleagues.", done: true },
    { id: "step_3", order: 3, title: "Install plugins", description: "Pick the domains you need.", done: false },
    { id: "step_4", order: 4, title: "Connect data", description: "Import CRM, accounting, or inventory.", done: false },
    { id: "step_5", order: 5, title: "Go live", description: "Flip the switch for your first user.", done: false },
  ]);

  /* Release notes. */
  put("platform.release", [
    {
      id: "v1.5.0",
      version: "1.5.0",
      releasedAt: "2026-04-23",
      entries: [
        { kind: "feat", text: "Realtime WebSocket sync across tabs" },
        { kind: "feat", text: "File uploads with audit trail" },
        { kind: "feat", text: "MFA (TOTP) + password reset + email verification" },
        { kind: "feat", text: "All dashboards now computed from live data" },
      ],
    },
    {
      id: "v1.4.0",
      version: "1.4.0",
      releasedAt: "2026-04-18",
      entries: [
        { kind: "feat", text: "Universal admin panel with 55+ plugins" },
        { kind: "feat", text: "Schema-driven list/form/detail renderers" },
        { kind: "feat", text: "Kanban, calendar, timeline primitives" },
      ],
    },
    {
      id: "v1.3.1",
      version: "1.3.1",
      releasedAt: "2026-04-02",
      entries: [
        { kind: "fix", text: "Stable query snapshots — no more useSyncExternalStore loops" },
        { kind: "chore", text: "Migrated admin shell workbench to Vite 6" },
      ],
    },
  ]);

  /* Global notifications (platform-wide). */
  const notifs: Record<string, unknown>[] = [];
  const samples = [
    "New contact: Ada Lovelace",
    "Ticket SUP-1021 assigned to you",
    "Invoice INV-1024 paid",
    "Deal Acme Corp — expansion moved to Negotiate",
    "Booking BKG-1015 cancelled",
    "Low stock: Widget A",
    "AI eval tone-check regressed by 3%",
    "New signup: globex.com",
    "Payroll 2026-03 ready for approval",
    "Webhook failing: staging.globex.io/in",
    "Ada Lovelace marked VIP",
    "Inventory sync completed",
  ];
  const intents = ["info", "warning", "success", "info", "warning", "danger", "warning", "info", "info", "danger", "accent", "success"];
  for (let i = 0; i < 12; i++) {
    notifs.push({
      id: `notif_${i + 1}`,
      title: samples[i],
      intent: intents[i],
      read: i > 4,
      createdAt: new Date(Date.now() - i * 37 * 60_000).toISOString(),
      recipient: "chinmoy@gutu.dev",
    });
  }
  put("platform.notification", notifs);

  /* Command palette / search index — proper indexed documents. */
  put(
    "platform.search-index",
    [
      { id: "si_ct_200", label: "Ada Lovelace", kind: "Contact", path: "/contacts/ct_200" },
      { id: "si_inv_3", label: "INV-1003 — Acme Corp", kind: "Invoice", path: "/accounting/invoices/accounting_invoice_3" },
      { id: "si_sup_7", label: "SUP-1007 Cannot log in", kind: "Ticket", path: "/support/tickets/support-service_ticket_7" },
      { id: "si_model_1", label: "claude-opus-4-7", kind: "Model", path: "/ai/models/ai-core_model_1" },
      { id: "si_tenant_2", label: "Globex", kind: "Tenant", path: "/platform/tenants/org-tenant_tenant_2" },
      { id: "si_deal_0", label: "Acme Corp — expansion", kind: "Deal", path: "/sales/deals/dl_500" },
      { id: "si_space_gen", label: "General", kind: "Space", path: "/community/spaces/sp_gen" },
      { id: "si_booking_100", label: "BKG-1000", kind: "Booking", path: "/bookings/bk_100" },
    ],
  );

  return counts;
}
