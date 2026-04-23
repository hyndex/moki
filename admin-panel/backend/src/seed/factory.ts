import { bulkInsert } from "../lib/query";
import {
  CITIES,
  COMPANIES,
  code,
  daysAgo,
  hoursAgo,
  money,
  pick,
  personEmail,
  personName,
  REP_NAMES,
} from "./helpers";

/** One entry per factory-seeded resource. Same patterns as the admin-panel
 *  factory plugins so the UI renders with familiar content. */
export function seedFactory(): Record<string, number> {
  const counts: Record<string, number> = {};
  const put = <T extends Record<string, unknown>>(resource: string, rows: T[]) => {
    counts[resource] = bulkInsert(resource, rows);
  };

  /* Booking ------------------------------------------------------------- */
  const bookingServices = ["Consultation", "Deep clean", "Strategy call", "On-site visit", "Training"];
  const bookingCustomers = COMPANIES.map((c) => c.name);
  const bookingStatuses = ["draft", "confirmed", "confirmed", "completed", "cancelled", "confirmed"];
  put(
    "booking.booking",
    Array.from({ length: 18 }, (_, i) => ({
      id: `bk_${i + 100}`,
      code: code("BKG", i),
      customer: pick(bookingCustomers, i),
      service: pick(bookingServices, i),
      startAt: new Date(Date.now() + (i - 5) * 36 * 3600_000).toISOString(),
      durationMin: 30 + (i % 4) * 30,
      status: pick(bookingStatuses, i),
      amount: 75 + ((i * 13) % 400),
      notes: i % 3 === 0 ? "Needs parking validation" : "",
    })),
  );

  /* Accounting ---------------------------------------------------------- */
  put(
    "accounting.invoice",
    Array.from({ length: 24 }, (_, i) => ({
      id: `accounting_invoice_${i + 1}`,
      number: code("INV", i),
      customer: pick(COMPANIES, i).name,
      status: pick(["draft", "pending", "approved", "published", "archived"], i),
      issuedAt: daysAgo(i * 3),
      dueAt: daysAgo(i * 3 - 30),
      amount: money(i, 200, 20000),
      currency: pick(["USD", "EUR", "GBP"], i),
      notes: i % 4 === 0 ? "Net 30" : "",
    })),
  );
  put(
    "accounting.bill",
    Array.from({ length: 18 }, (_, i) => ({
      id: `accounting_bill_${i + 1}`,
      number: code("BILL", i),
      vendor: pick(COMPANIES, i + 2).name,
      status: pick(["pending", "approved", "published"], i),
      dueAt: daysAgo(i * 2 - 15),
      amount: money(i, 100, 8000),
    })),
  );
  put(
    "accounting.account",
    Array.from({ length: 20 }, (_, i) => ({
      id: `accounting_account_${i + 1}`,
      code: String(1000 + i * 10),
      name: pick(
        ["Cash", "Accounts Receivable", "Inventory", "Accounts Payable", "Sales Revenue", "COGS", "Rent", "Utilities"],
        i,
      ),
      type: pick(["asset", "liability", "revenue", "expense"], i),
      balance: money(i, 500, 50000),
    })),
  );

  /* Payments ------------------------------------------------------------ */
  put(
    "payments.payment",
    Array.from({ length: 20 }, (_, i) => ({
      id: `pay_${i + 1}`,
      reference: code("PAY", i, 6),
      payer: personName(i),
      amount: money(i, 20, 5000),
      method: pick(["card", "ach", "wire", "card"], i),
      status: pick(["succeeded", "succeeded", "succeeded", "failed", "refunded"], i),
      paidAt: daysAgo(i),
    })),
  );

  /* E-invoicing --------------------------------------------------------- */
  put(
    "e-invoicing.document",
    Array.from({ length: 14 }, (_, i) => ({
      id: `einv_${i + 1}`,
      irn: code("IRN", i, 8),
      country: pick(["IN", "MX", "IT", "AE"], i),
      counterparty: pick(COMPANIES, i).name,
      amount: money(i, 200, 15000),
      status: pick(["pending", "approved", "published"], i),
      issuedAt: daysAgo(i),
    })),
  );

  /* Treasury ------------------------------------------------------------ */
  put(
    "treasury.account",
    Array.from({ length: 6 }, (_, i) => ({
      id: `bank_${i + 1}`,
      name: pick(["Ops USD", "Reserve EUR", "Payroll USD", "Operating GBP"], i),
      bank: pick(["Chase", "HSBC", "Barclays", "Wise"], i),
      currency: pick(["USD", "EUR", "GBP"], i),
      balance: money(i, 10000, 500000),
    })),
  );
  put(
    "treasury.transfer",
    Array.from({ length: 12 }, (_, i) => ({
      id: `tx_${i + 1}`,
      from: pick(["Ops USD", "Reserve EUR"], i),
      to: pick(["Payroll USD", "Operating GBP"], i + 1),
      amount: money(i, 1000, 50000),
      status: pick(["pending", "settled", "settled"], i),
      initiatedAt: daysAgo(i),
    })),
  );

  /* Inventory, manufacturing, procurement, assets, cmms, quality, trace - */
  put(
    "inventory.item",
    Array.from({ length: 28 }, (_, i) => ({
      id: `inv_item_${i + 1}`,
      sku: code("SKU", i, 5),
      name: `${pick(["Widget A", "Gizmo B", "Part C", "Bracket D", "Screw E"], i)} #${i}`,
      category: pick(["raw", "wip", "finished"], i),
      onHand: (i * 13) % 500,
      reorderPoint: 20 + ((i * 7) % 60),
      unitCost: money(i, 1, 200),
    })),
  );
  put(
    "inventory.warehouse",
    Array.from({ length: 6 }, (_, i) => ({
      id: `wh_${i + 1}`,
      code: pick(["WH-SFO", "WH-AUS", "WH-LHR", "WH-FRA", "WH-NRT", "WH-SYD"], i),
      name: pick(["San Francisco", "Austin", "London", "Frankfurt", "Tokyo", "Sydney"], i) + " DC",
      city: pick(["San Francisco", "Austin", "London", "Frankfurt", "Tokyo", "Sydney"], i),
      capacity: 50_000 + ((i * 10_000) % 200_000),
    })),
  );
  put(
    "manufacturing.order",
    Array.from({ length: 14 }, (_, i) => ({
      id: `mo_${i + 1}`,
      code: code("MO", i),
      product: pick(["Widget A", "Gizmo B", "Part C"], i),
      quantity: 100 + ((i * 43) % 900),
      status: pick(["open", "in_progress", "resolved"], i),
      dueAt: daysAgo(-i * 2),
    })),
  );
  put(
    "procurement.purchase-order",
    Array.from({ length: 14 }, (_, i) => ({
      id: `po_${i + 1}`,
      number: code("PO", i),
      vendor: pick(COMPANIES, i + 2).name,
      status: pick(["draft", "pending", "approved", "published"], i),
      total: money(i, 500, 50000),
      expectedAt: daysAgo(-i * 3),
    })),
  );
  put(
    "assets.asset",
    Array.from({ length: 24 }, (_, i) => ({
      id: `asset_${i + 1}`,
      tag: code("AST", i, 5),
      name: pick(["MacBook Pro", "Dell XPS", "Ford Transit", "Forklift", "Scanner"], i),
      category: pick(["laptop", "vehicle", "equipment", "machinery"], i),
      location: pick(CITIES, i),
      status: pick(["deployed", "deployed", "in_storage", "maintenance"], i),
      purchasedAt: daysAgo(i * 30),
      cost: 500 + ((i * 1097) % 40000),
    })),
  );
  put(
    "maintenance-cmms.work-order",
    Array.from({ length: 14 }, (_, i) => ({
      id: `wo_${i + 1}`,
      code: code("WO", i),
      asset: pick(["Forklift #2", "HVAC-North", "Press A", "Conveyor 1"], i),
      task: pick(["Inspect", "Replace filter", "Lubricate", "Calibrate"], i),
      priority: pick(["low", "normal", "high"], i),
      status: pick(["open", "in_progress", "resolved"], i),
      dueAt: daysAgo(-i * 2),
    })),
  );
  put(
    "quality.inspection",
    Array.from({ length: 14 }, (_, i) => ({
      id: `qa_${i + 1}`,
      code: code("QA", i),
      product: pick(["Widget A", "Gizmo B", "Part C"], i),
      inspector: pick(["Taylor", "Sam"], i),
      severity: pick(["info", "warn", "error"], i),
      status: pick(["open", "resolved"], i),
      inspectedAt: daysAgo(i),
    })),
  );
  put(
    "traceability.lot",
    Array.from({ length: 14 }, (_, i) => ({
      id: `lot_${i + 1}`,
      code: code("LOT", i, 8),
      product: pick(["Widget A", "Gizmo B", "Part C"], i),
      origin: pick(["SFO Plant", "Tokyo Plant", "Berlin Plant"], i),
      producedAt: daysAgo(i * 3),
    })),
  );

  /* People -------------------------------------------------------------- */
  put(
    "hr-payroll.employee",
    Array.from({ length: 18 }, (_, i) => ({
      id: `emp_${i + 1}`,
      name: personName(i),
      email: personEmail(i, "gutu.dev"),
      department: pick(["eng", "ops", "sales", "support", "hr"], i),
      role: pick(["Engineer", "Designer", "Manager", "Lead", "Specialist"], i),
      hiredAt: daysAgo(i * 60),
    })),
  );
  put(
    "hr-payroll.payroll",
    Array.from({ length: 8 }, (_, i) => ({
      id: `run_${i + 1}`,
      period: `2026-${String(i + 1).padStart(2, "0")}`,
      employees: 42 + (i % 10),
      gross: money(i, 50000, 200000),
      status: pick(["paid", "paid", "pending"], i),
      processedAt: daysAgo(i * 30),
    })),
  );
  put(
    "auth.user",
    Array.from({ length: 22 }, (_, i) => ({
      id: `authuser_${i + 1}`,
      name: personName(i),
      email: personEmail(i, "gutu.dev"),
      role: pick(["admin", "member", "member", "member", "viewer"], i),
      mfa: i % 3 !== 0,
      lastLogin: hoursAgo(i * 4),
    })),
  );
  put(
    "auth.session",
    Array.from({ length: 18 }, (_, i) => ({
      id: `sess_${i + 1}`,
      user: personEmail(i, "gutu.dev"),
      ip: `10.0.${i}.${(i * 7) % 255}`,
      userAgent: pick(["Safari/17", "Chrome/131", "Firefox/133", "iOS Safari"], i),
      createdAt: daysAgo(i * 0.5),
    })),
  );
  put(
    "role-policy.role",
    [
      { id: "role_1", name: "Admin", description: "Full access", members: 3 },
      { id: "role_2", name: "Manager", description: "Team-level controls", members: 6 },
      { id: "role_3", name: "Engineer", description: "Read+write code resources", members: 24 },
      { id: "role_4", name: "Sales Rep", description: "CRM and orders", members: 12 },
      { id: "role_5", name: "Support", description: "Tickets and KB", members: 8 },
      { id: "role_6", name: "Finance", description: "Invoices + payments", members: 4 },
    ],
  );
  put(
    "role-policy.policy",
    [
      { id: "pol_1", name: "Read invoices", resource: "accounting.invoice", effect: "allow" },
      { id: "pol_2", name: "Export contacts", resource: "crm.contact", effect: "allow" },
      { id: "pol_3", name: "Delete records", resource: "*", effect: "deny" },
      { id: "pol_4", name: "Manage users", resource: "auth.user", effect: "allow" },
      { id: "pol_5", name: "Audit access", resource: "audit.event", effect: "allow" },
    ],
  );
  put(
    "user-directory.person",
    Array.from({ length: 20 }, (_, i) => ({
      id: `dir_${i + 1}`,
      name: personName(i),
      email: personEmail(i, "gutu.dev"),
      title: pick(["Engineer", "Designer", "Manager", "Ops Lead"], i),
      department: pick(["Engineering", "Operations", "Sales", "Support"], i),
      city: pick(CITIES, i),
    })),
  );

  /* Commerce ------------------------------------------------------------ */
  put(
    "product-catalog.product",
    Array.from({ length: 26 }, (_, i) => ({
      id: `prod_${i + 1}`,
      sku: code("P", i, 6),
      name: `${pick(["Classic Tee", "Running Shoes", "Coffee Mug", "Wireless Mouse", "Notebook"], i)} v${1 + (i % 5)}`,
      category: pick(["apparel", "electronics", "home", "books"], i),
      price: money(i, 9, 500),
      status: pick(["active", "active", "archived"], i),
    })),
  );
  put(
    "pricing-tax.price",
    Array.from({ length: 18 }, (_, i) => ({
      id: `price_${i + 1}`,
      sku: code("PR", i, 5),
      name: pick(["Widget A", "Gizmo B", "Part C"], i),
      amount: money(i, 5, 500),
      currency: pick(["USD", "EUR"], i),
    })),
  );
  put(
    "pricing-tax.tax-rule",
    Array.from({ length: 9 }, (_, i) => ({
      id: `tax_${i + 1}`,
      name: pick(["US sales tax", "EU VAT", "UK VAT", "CA GST", "IN GST"], i),
      region: pick(["US-CA", "EU-DE", "UK", "CA-ON", "IN-MH"], i),
      rate: 0.05 + i * 0.02,
    })),
  );
  put(
    "pos.terminal",
    Array.from({ length: 8 }, (_, i) => ({
      id: `pos_${i + 1}`,
      code: code("POS", i, 4),
      location: pick(["Downtown", "Airport", "Mall", "Outlet"], i),
      status: pick(["online", "online", "offline"], i),
      lastCheckin: daysAgo(i * 0.2),
    })),
  );
  put(
    "pos.sale",
    Array.from({ length: 26 }, (_, i) => ({
      id: `sale_${i + 1}`,
      ref: code("SALE", i, 6),
      terminal: code("POS", i % 4, 4),
      items: 1 + (i % 8),
      total: money(i, 5, 500),
      occurredAt: daysAgo(i * 0.5),
    })),
  );
  put(
    "subscriptions.subscription",
    Array.from({ length: 18 }, (_, i) => ({
      id: `sub_${i + 1}`,
      ref: code("SUB", i, 6),
      customer: pick(COMPANIES, i).name,
      plan: pick(["starter", "pro", "enterprise"], i),
      mrr: money(i, 10, 5000),
      status: pick(["trialing", "active", "active", "past_due", "canceled"], i),
      renewsAt: daysAgo(-i * 5),
    })),
  );

  /* Operations ---------------------------------------------------------- */
  put(
    "support-service.ticket",
    Array.from({ length: 26 }, (_, i) => ({
      id: `ticket_${i + 1}`,
      code: code("SUP", i),
      subject: pick(["Cannot log in", "Missing invoice", "Feature request", "Slow report", "Billing question"], i),
      requester: personName(i),
      assignee: pick(["Sam", "Alex", "Taylor"], i),
      priority: pick(["low", "normal", "high", "urgent"], i),
      status: pick(["open", "in_progress", "resolved", "closed"], i),
      updatedAt: daysAgo(i * 0.5),
    })),
  );
  put(
    "field-service.job",
    Array.from({ length: 18 }, (_, i) => ({
      id: `fs_${i + 1}`,
      code: code("FS", i),
      customer: personName(i),
      technician: pick(["Taylor", "Jordan", "Casey", "Morgan"], i),
      location: pick(CITIES, i),
      priority: pick(["low", "normal", "high", "urgent"], i),
      status: pick(["open", "in_progress", "resolved"], i),
      scheduledAt: daysAgo(i - 3),
    })),
  );
  put(
    "projects.project",
    Array.from({ length: 12 }, (_, i) => ({
      id: `prj_${i + 1}`,
      code: code("PRJ", i),
      name: pick(["Migrate to v2", "Redesign billing", "Launch EU", "Mobile app", "Data warehouse"], i),
      owner: personName(i),
      status: pick(["open", "in_progress", "resolved"], i),
      priority: pick(["normal", "high", "urgent"], i),
      dueAt: daysAgo(-i * 15),
    })),
  );
  put(
    "issues.issue",
    Array.from({ length: 20 }, (_, i) => ({
      id: `iss_${i + 1}`,
      code: code("ISS", i),
      title: pick(["Login fails in Safari", "Slow dashboard", "Typo in settings", "Export broken", "Email bounces"], i),
      assignee: personName(i),
      priority: pick(["low", "normal", "high", "urgent"], i),
      status: pick(["open", "in_progress", "resolved", "closed"], i),
      updatedAt: daysAgo(i),
    })),
  );

  /* Workspace ----------------------------------------------------------- */
  put(
    "content.article",
    Array.from({ length: 18 }, (_, i) => ({
      id: `art_${i + 1}`,
      title: pick(["Getting started", "API reference", "Pricing update", "Changelog v1.2", "Security policy"], i),
      slug: pick(["getting-started", "api", "pricing", "changelog-1-2", "security"], i),
      status: pick(["draft", "approved", "published", "published"], i),
      author: pick(["sam@gutu.dev", "alex@gutu.dev", "taylor@gutu.dev"], i),
      updatedAt: daysAgo(i),
      body: "Lorem ipsum…",
    })),
  );
  put(
    "document.doc",
    Array.from({ length: 16 }, (_, i) => ({
      id: `doc_${i + 1}`,
      title: pick(["Onboarding handbook", "2026 plan", "Q1 review", "Policy v3", "Release notes"], i),
      type: pick(["md", "rich", "docx", "pdf"], i),
      owner: pick(["sam@gutu.dev", "alex@gutu.dev"], i),
      updatedAt: daysAgo(i),
    })),
  );
  put(
    "files.file",
    Array.from({ length: 22 }, (_, i) => ({
      id: `file_${i + 1}`,
      name: pick(["contract.pdf", "photo.jpg", "data.csv", "presentation.pptx", "logo.svg"], i),
      mimeType: pick(["application/pdf", "image/jpeg", "text/csv", "application/vnd.ms-powerpoint", "image/svg+xml"], i),
      sizeBytes: 1024 * (100 + ((i * 131) % 9000)),
      owner: pick(["sam@gutu.dev", "alex@gutu.dev"], i),
      uploadedAt: daysAgo(i),
    })),
  );
  put(
    "contracts.contract",
    Array.from({ length: 16 }, (_, i) => ({
      id: `con_${i + 1}`,
      name: `${pick(["MSA", "NDA", "Order Form", "DPA", "SOW"], i)} — ${pick(COMPANIES, i).name}`,
      counterparty: pick(COMPANIES, i).name,
      value: money(i, 1000, 500_000),
      status: pick(["draft", "pending", "approved", "published"], i),
      expiresAt: daysAgo(-60 + ((i * 13) % 365)),
    })),
  );
  put(
    "forms.form",
    Array.from({ length: 10 }, (_, i) => ({
      id: `form_${i + 1}`,
      name: pick(["Contact us", "Support request", "NPS survey", "Demo request", "Waitlist"], i),
      slug: pick(["contact", "support", "nps", "demo", "waitlist"], i),
      submissions: (i * 37) % 500,
      status: pick(["active", "active", "inactive"], i),
      updatedAt: daysAgo(i),
    })),
  );
  put(
    "knowledge.article",
    Array.from({ length: 14 }, (_, i) => ({
      id: `kb_${i + 1}`,
      title: pick(
        ["Resetting your password", "Setting up SSO", "Importing CSV", "Understanding invoices", "API limits"],
        i,
      ),
      category: pick(["getting-started", "troubleshooting", "api", "billing"], i),
      status: pick(["draft", "published", "published"], i),
      views: (i * 131) % 5000,
      updatedAt: daysAgo(i),
    })),
  );
  put(
    "template.template",
    Array.from({ length: 10 }, (_, i) => ({
      id: `tpl_${i + 1}`,
      name: pick(["Welcome email", "Invoice document", "Landing page", "NDA template", "Offer letter"], i),
      kind: pick(["email", "document", "page"], i),
      status: pick(["active", "active", "inactive"], i),
      updatedAt: daysAgo(i),
    })),
  );

  /* Portals & Pages ----------------------------------------------------- */
  put(
    "company-builder.company",
    Array.from({ length: 12 }, (_, i) => ({
      id: `co_${i + 1}`,
      name: pick(COMPANIES, i).name,
      domain: `https://${pick(COMPANIES, i).domain}`,
      industry: pick(["saas", "retail", "manufacturing", "services"], i),
      status: pick(["draft", "approved", "published"], i),
      createdAt: daysAgo(i * 4),
    })),
  );
  put(
    "business-portals.portal",
    Array.from({ length: 8 }, (_, i) => ({
      id: `portal_${i + 1}`,
      name: pick(["Customer Portal", "Partner Hub", "Vendor Desk", "Supplier Board"], i),
      tenant: pick(COMPANIES, i).name,
      domain: `https://portal.${pick(COMPANIES, i).domain}`,
      status: pick(["active", "active", "inactive"], i),
      updatedAt: daysAgo(i),
    })),
  );
  put(
    "page-builder.page",
    Array.from({ length: 12 }, (_, i) => ({
      id: `page_${i + 1}`,
      title: pick(["Home", "Pricing", "About", "Careers", "Changelog"], i),
      slug: pick(["", "pricing", "about", "careers", "changelog"], i),
      status: pick(["draft", "published", "published"], i),
      updatedAt: daysAgo(i),
    })),
  );
  put(
    "portal.session",
    Array.from({ length: 14 }, (_, i) => ({
      id: `psess_${i + 1}`,
      user: `customer+${i}@example.com`,
      status: pick(["active", "inactive"], i),
      startedAt: daysAgo(i),
    })),
  );

  /* AI ----------------------------------------------------------------- */
  put(
    "ai-core.model",
    Array.from({ length: 12 }, (_, i) => ({
      id: `model_${i + 1}`,
      name: pick(
        ["claude-opus-4-7", "claude-sonnet-4-6", "gpt-4o", "gemini-2.5-pro", "llama-3.1-70b"],
        i,
      ),
      provider: pick(["anthropic", "anthropic", "openai", "google", "local"], i),
      contextWindow: pick([1_000_000, 200_000, 128_000, 2_000_000, 8192], i),
      status: pick(["active", "inactive"], i),
    })),
  );
  put(
    "ai-core.prompt",
    Array.from({ length: 10 }, (_, i) => ({
      id: `prompt_${i + 1}`,
      name: pick(
        ["summarize-invoice", "classify-intent", "extract-contact", "rewrite-support", "translate-copy"],
        i,
      ),
      version: `v${1 + (i % 5)}`,
      updatedAt: daysAgo(i),
      body: "You are a helpful assistant…",
    })),
  );
  put(
    "ai-evals.suite",
    Array.from({ length: 8 }, (_, i) => ({
      id: `suite_${i + 1}`,
      name: pick(
        ["regression-core", "tone-check", "refusal-rate", "fact-recall", "instruction-follow"],
        i,
      ),
      cases: 40 + ((i * 7) % 120),
      passRate: 72 + ((i * 13) % 27),
      lastRun: daysAgo(i),
    })),
  );
  put(
    "ai-evals.run",
    Array.from({ length: 20 }, (_, i) => ({
      id: `evalrun_${i + 1}`,
      suite: pick(["regression-core", "tone-check", "refusal-rate"], i),
      model: pick(["claude-opus-4-7", "claude-sonnet-4-6", "gpt-4o"], i),
      startedAt: daysAgo(i),
      passRate: 72 + ((i * 11) % 28),
      durationSec: 90 + ((i * 29) % 600),
    })),
  );
  put(
    "ai-rag.collection",
    Array.from({ length: 9 }, (_, i) => ({
      id: `coll_${i + 1}`,
      name: pick(["docs-v2", "support-kb", "sales-playbook", "onboarding", "policies"], i),
      embedder: pick(["text-embedding-3-large", "voyage-2", "cohere-v3"], i),
      chunks: 500 + ((i * 97) % 5000),
      status: pick(["active", "active", "inactive"], i),
      updatedAt: daysAgo(i),
    })),
  );
  put(
    "ai-skills.skill",
    Array.from({ length: 14 }, (_, i) => ({
      id: `skill_${i + 1}`,
      name: pick(
        ["pptx", "docx", "xlsx", "pdf", "setup-cowork", "skill-creator", "design-critique", "code-review", "debug"],
        i,
      ),
      trigger: pick(["manual", "automatic", "on-mention"], i),
      version: `0.${i + 1}`,
      status: pick(["active", "active", "inactive"], i),
    })),
  );
  put(
    "ai-assist.thread",
    Array.from({ length: 14 }, (_, i) => ({
      id: `thread_${i + 1}`,
      title: pick(
        ["Draft Q3 OKRs", "Rewrite landing page", "Find duplicates in CRM", "Summarize interview", "Plan migration"],
        i,
      ),
      owner: pick(["sam@gutu.dev", "alex@gutu.dev", "taylor@gutu.dev"], i),
      messages: 2 + ((i * 3) % 40),
      lastActive: hoursAgo(i * 2),
    })),
  );
  put(
    "ai-assist.memory",
    Array.from({ length: 18 }, (_, i) => ({
      id: `mem_${i + 1}`,
      summary: pick(
        [
          "User prefers terse responses",
          "Accounting invoices use Net 30",
          "Company is Gutu framework workspace",
          "Booking confirmations go to ops@",
        ],
        i,
      ),
      type: pick(["user", "project", "feedback"], i),
      createdAt: daysAgo(i * 2),
    })),
  );

  /* Automation --------------------------------------------------------- */
  put(
    "automation.trigger",
    Array.from({ length: 12 }, (_, i) => ({
      id: `trig_${i + 1}`,
      name: pick(["Notify on new contact", "Send invoice reminder", "Escalate stale issue", "Sync inventory"], i),
      event: pick(["contact.created", "invoice.overdue", "issue.stale", "inventory.low"], i),
      status: pick(["active", "active", "inactive"], i),
      lastFired: hoursAgo(i),
    })),
  );
  put(
    "automation.run",
    Array.from({ length: 30 }, (_, i) => ({
      id: `arun_${i + 1}`,
      trigger: pick(["Notify on new contact", "Send invoice reminder", "Sync inventory"], i),
      severity: pick(["info", "info", "warn", "error"], i),
      startedAt: daysAgo(i * 0.3),
      durationMs: 80 + ((i * 193) % 2400),
    })),
  );
  put(
    "workflow.workflow",
    Array.from({ length: 10 }, (_, i) => ({
      id: `wf_${i + 1}`,
      name: pick(
        ["Onboard customer", "Close month-end", "Ship order", "Process refund", "Approve expense"],
        i,
      ),
      steps: 3 + (i % 6),
      status: pick(["active", "active", "inactive"], i),
      lastRun: daysAgo(i),
    })),
  );
  put(
    "jobs.job",
    Array.from({ length: 24 }, (_, i) => ({
      id: `job_${i + 1}`,
      name: pick(
        ["nightly-invoice", "sync-inventory", "send-digests", "reindex-search", "expire-tokens"],
        i,
      ),
      queue: pick(["default", "critical", "low"], i),
      severity: pick(["info", "info", "warn", "error"], i),
      attempts: 1 + (i % 4),
      runAt: daysAgo(i * 0.2),
    })),
  );
  put(
    "notifications.template",
    Array.from({ length: 10 }, (_, i) => ({
      id: `ntpl_${i + 1}`,
      name: pick(["Welcome", "Invoice sent", "Password reset", "Booking confirmed", "Payment failed"], i),
      channel: pick(["email", "email", "sms", "push"], i),
      status: pick(["active", "active", "inactive"], i),
      updatedAt: daysAgo(i),
    })),
  );
  put(
    "notifications.delivery",
    Array.from({ length: 22 }, (_, i) => ({
      id: `ndel_${i + 1}`,
      template: pick(["Welcome", "Invoice sent", "Password reset"], i),
      recipient: `user+${i}@example.com`,
      status: pick(["sent", "sent", "sent", "bounced", "queued"], i),
      sentAt: hoursAgo(i),
    })),
  );
  put(
    "integration.connection",
    Array.from({ length: 10 }, (_, i) => ({
      id: `conn_${i + 1}`,
      provider: pick(["slack", "stripe", "hubspot", "github", "salesforce"], i),
      name: pick(["Primary", "Ops", "Revenue", "Engineering"], i),
      status: pick(["active", "active", "inactive"], i),
      lastSync: daysAgo(i * 0.3),
    })),
  );

  /* Analytics ---------------------------------------------------------- */
  put(
    "analytics-bi.report",
    Array.from({ length: 12 }, (_, i) => ({
      id: `rep_${i + 1}`,
      name: pick(["Weekly MRR", "Pipeline snapshot", "Ticket aging", "Inventory turns", "NPS by segment"], i),
      dataset: pick(["subscriptions", "sales", "support", "inventory", "community"], i),
      owner: pick(["sam@gutu.dev", "alex@gutu.dev"], i),
      updatedAt: daysAgo(i),
    })),
  );
  put(
    "analytics-bi.dashboard",
    Array.from({ length: 6 }, (_, i) => ({
      id: `bidash_${i + 1}`,
      name: pick(["Exec overview", "Finance", "Ops", "Product", "Customer"], i),
      owner: pick(["sam@gutu.dev", "alex@gutu.dev"], i),
      widgets: 6 + (i % 8),
      updatedAt: daysAgo(i),
    })),
  );

  /* Platform ----------------------------------------------------------- */
  put(
    "dashboards.board",
    Array.from({ length: 8 }, (_, i) => ({
      id: `pfdash_${i + 1}`,
      name: pick(["Exec overview", "Sales pipeline", "Ops health", "Support SLA", "Finance"], i),
      owner: pick(["sam@gutu.dev", "alex@gutu.dev"], i),
      widgets: 4 + (i % 10),
      updatedAt: daysAgo(i),
    })),
  );
  put(
    "org-tenant.tenant",
    Array.from({ length: 10 }, (_, i) => ({
      id: `tenant_${i + 1}`,
      name: pick(["Gutu", "Acme", "Globex", "Initech", "Hooli"], i),
      plan: pick(["free", "pro", "enterprise"], i),
      status: pick(["active", "active", "inactive"], i),
      seats: 5 + ((i * 17) % 200),
      createdAt: daysAgo(i * 30),
    })),
  );
  put(
    "runtime-bridge.channel",
    Array.from({ length: 8 }, (_, i) => ({
      id: `chan_${i + 1}`,
      name: pick(["orders.events", "crm.commands", "inventory.queries", "auth.events"], i),
      kind: pick(["event", "command", "query"], i),
      status: pick(["active", "active", "inactive"], i),
      lastMessage: daysAgo(i * 0.2),
    })),
  );
  put(
    "execution-workspaces.workspace",
    Array.from({ length: 9 }, (_, i) => ({
      id: `ws_${i + 1}`,
      name: pick(
        ["quizzical-lamport", "witty-hopper", "noble-turing", "eager-ada", "happy-ritchie"],
        i,
      ),
      owner: pick(["sam@gutu.dev", "alex@gutu.dev"], i),
      kind: pick(["claude", "cli", "notebook"], i),
      lastActive: daysAgo(i * 0.5),
    })),
  );
  put(
    "search.index",
    Array.from({ length: 9 }, (_, i) => ({
      id: `idx_${i + 1}`,
      name: pick(["contacts", "products", "invoices", "tickets", "pages"], i),
      resource: pick(
        ["crm.contact", "product-catalog.product", "accounting.invoice", "issues.issue", "page-builder.page"],
        i,
      ),
      documents: 1000 + ((i * 7919) % 50000),
      status: pick(["active", "active", "inactive"], i),
      updatedAt: daysAgo(i),
    })),
  );

  /* Audit (read-only events for the Audit plugin list) ----------------- */
  put(
    "audit.event",
    Array.from({ length: 40 }, (_, i) => {
      const actions = [
        "booking.created", "booking.confirmed", "booking.cancelled",
        "contact.created", "contact.updated", "contact.vip.flagged",
        "auth.login", "auth.logout", "role.assigned", "settings.changed",
      ];
      const action = pick(actions, i);
      return {
        id: `ev_${i + 1}`,
        actor: pick(
          ["chinmoy@gutu.dev", "system", "sam@gutu.dev", "alex@gutu.dev", "taylor@gutu.dev"],
          i,
        ),
        action,
        resource: action.split(".")[0],
        recordId: `rec_${1000 + ((i * 37) % 800)}`,
        level: pick(["info", "info", "info", "warn", "info", "info", "error", "info"], i),
        occurredAt: daysAgo(i * (43 / 60) / 24),
        ip: `10.0.${i % 255}.${(i * 31) % 255}`,
      };
    }),
  );

  return counts;
}
