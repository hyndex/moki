import { bulkInsert } from "../lib/query";
import {
  COMPANIES,
  FIRST_NAMES,
  LAST_NAMES,
  REP_NAMES,
  code,
  daysAgo,
  hoursAgo,
  money,
  pick,
  personName,
} from "./helpers";

const STAGES = ["lead", "prospect", "customer", "churned"] as const;
const DEAL_STAGES = [
  { id: "qualify", probability: 0.1 },
  { id: "proposal", probability: 0.35 },
  { id: "negotiate", probability: 0.65 },
  { id: "won", probability: 1.0 },
  { id: "lost", probability: 0 },
] as const;

export function seedSalesCrm(): Record<string, number> {
  const counts: Record<string, number> = {};

  /* Contacts ------------------------------------------------------------- */
  const contacts = Array.from({ length: 44 }, (_, i) => {
    const f = pick(FIRST_NAMES, i);
    const l = pick(LAST_NAMES, i + 5);
    const company = pick(COMPANIES, i);
    const vip = i % 7 === 0;
    return {
      id: `ct_${i + 100}`,
      firstName: f,
      lastName: l,
      name: `${f} ${l}`,
      title: pick(
        ["VP Eng", "CTO", "CEO", "Head of Ops", "COO", "Product Lead", "Director"],
        i,
      ),
      company: company.name,
      email: `${f.toLowerCase()}.${l.toLowerCase().replace(/\s+/g, "")}@${company.domain}`,
      phone: `+1 555 ${String(100 + i).padStart(3, "0")} ${String(1000 + i * 7).slice(-4)}`,
      stage: pick(STAGES, i),
      owner: pick(REP_NAMES, i),
      vip,
      lifetimeValue: 500 + ((i * 911) % 85_000),
      createdAt: daysAgo(30 + (i * 3) % 400),
      lastActivityAt: daysAgo((i * 2 + 1) % 40),
      activityTrend: Array.from({ length: 12 }, (_, j) => 2 + ((j + i) * 3) % 14),
      tags: [pick(["vip", "enterprise", "growth", "strategic", "free-tier", "overdue", "new"], i), ...(vip ? ["vip"] : [])]
        .filter((t, idx, a) => a.indexOf(t) === idx),
    };
  });
  counts["crm.contact"] = bulkInsert("crm.contact", contacts);

  /* Deals ---------------------------------------------------------------- */
  const deals = Array.from({ length: 28 }, (_, i) => {
    const stageDef = DEAL_STAGES[(i + 1) % DEAL_STAGES.length];
    const company = pick(COMPANIES, i + 2);
    const contact = contacts[i % contacts.length];
    return {
      id: `dl_${500 + i}`,
      code: `D-${2000 + i}`,
      name: `${company.name} — ${pick(["expansion", "renewal", "new logo", "upsell", "pilot"], i)}`,
      account: company.name,
      contact: contact.name,
      owner: pick(REP_NAMES, i + 1),
      stage: stageDef.id,
      amount: 5_000 + ((i * 9137) % 180_000),
      probability: stageDef.probability,
      closeAt: daysAgo(i % 3 === 0 ? -i : -(30 - i * 2)),
      createdAt: daysAgo(60 + (i * 2) % 300),
      updatedAt: daysAgo((i * 3) % 40),
    };
  });
  counts["sales.deal"] = bulkInsert("sales.deal", deals);

  /* Quotes --------------------------------------------------------------- */
  const quotes = Array.from({ length: 18 }, (_, i) => ({
    id: `q_${800 + i}`,
    number: `Q-${3000 + i}`,
    account: pick(COMPANIES, i + 4).name,
    amount: 4_000 + ((i * 7919) % 60_000),
    status: pick(["draft", "sent", "accepted", "expired"], i),
    expiresAt: daysAgo(-7 + (i * 3) % 60),
  }));
  counts["sales.quote"] = bulkInsert("sales.quote", quotes);

  /* Activities ----------------------------------------------------------- */
  const kinds = ["email", "call", "meeting", "note", "task"] as const;
  const activities = Array.from({ length: 48 }, (_, i) => {
    const kind = kinds[i % kinds.length];
    const contact = contacts[i % contacts.length];
    const SUMMARIES: Record<typeof kind, string[]> = {
      email: [`Emailed ${contact.name} about pricing`, `Replied to inbound from ${contact.name}`, `Sent proposal to ${contact.name}`],
      call: [`Discovery call with ${contact.name} — 24 min`, `Left voicemail for ${contact.name}`, `Follow-up call with ${contact.name}`],
      meeting: [`Demo with ${contact.name} and team`, `QBR with ${contact.name}`, `Kick-off with ${contact.name}`],
      note: [`Noted: ${contact.name} renewing early`, `Noted: ${contact.name} flagged concern`, `Noted: ${contact.name} approved scope`],
      task: [`Send security questionnaire to ${contact.name}`, `Draft SOW for ${contact.name}`, `Schedule check-in with ${contact.name}`],
    };
    return {
      id: `act_${1000 + i}`,
      kind,
      contactId: contact.id,
      contactName: contact.name,
      summary: pick(SUMMARIES[kind], i),
      body: kind === "note" ? "They want annual billing and multi-region." : undefined,
      when: hoursAgo(i * 3 + 0.5),
      rep: pick(REP_NAMES, i),
    };
  });
  counts["crm.activity"] = bulkInsert("crm.activity", activities);

  /* Community ------------------------------------------------------------ */
  const spaces = [
    { id: "sp_gen", name: "General", handle: "general", description: "Workspace-wide announcements and chat.", members: 842, posts: 4320, visibility: "public", lastActive: hoursAgo(0.3) },
    { id: "sp_sup", name: "Support", handle: "support", description: "Customer support threads and internal triage.", members: 184, posts: 1892, visibility: "public", lastActive: hoursAgo(1.2) },
    { id: "sp_fb", name: "Feedback", handle: "feedback", description: "Product feedback and roadmap chatter.", members: 641, posts: 892, visibility: "public", lastActive: hoursAgo(2.1) },
    { id: "sp_launch", name: "Launch Room", handle: "launch", description: "Coordination for upcoming launches.", members: 42, posts: 310, visibility: "private", lastActive: hoursAgo(4) },
    { id: "sp_ptr", name: "Partners", handle: "partners", description: "Channel + strategic partner discussions.", members: 96, posts: 512, visibility: "private", lastActive: daysAgo(1) },
    { id: "sp_eng", name: "Engineering", handle: "engineering", description: "Internal engineering discussion.", members: 72, posts: 2210, visibility: "private", lastActive: hoursAgo(0.1) },
  ];
  counts["community.space"] = bulkInsert("community.space", spaces);

  const posts = Array.from({ length: 24 }, (_, i) => {
    const space = pick(spaces, i);
    const TITLES = [
      "Welcome thread — introduce yourself",
      "Release notes: v1.4 is live",
      "Feature idea: richer filters in list views",
      "Issue with CSV export — anyone else?",
      "Tips for onboarding new teammates",
      "We're hiring: senior engineers (remote)",
      "Partner program update",
      "Q3 roadmap — share feedback",
    ];
    const BODIES = [
      "Drop a 👋 and tell us what you're working on.",
      "Full changelog in the docs. Highlights: universal admin, command palette, ⌘K search.",
      "I'd love to filter by multiple stages at once — maybe a multi-select chip bar?",
      "Getting a blank file when I export > 10k rows. Both Safari and Chrome.",
      "Rolling out Gutu to a new team next week. Any tips?",
      "Expanding the platform team. Remote-friendly, full-time.",
      "New tiers for our partner program go live next month.",
      "Planning Q3 now — what should we prioritize?",
    ];
    return {
      id: `p_${2000 + i}`,
      author: personName(i),
      space: space.name,
      title: pick(TITLES, i),
      body: pick(BODIES, i),
      createdAt: hoursAgo(i * 4 + 1),
      replies: (i * 3) % 34,
      likes: (i * 7) % 120,
      pinned: i === 0 || i === 2,
    };
  });
  counts["community.post"] = bulkInsert("community.post", posts);

  const reports = Array.from({ length: 7 }, (_, i) => ({
    id: `m_${3000 + i}`,
    reportedBy: pick(REP_NAMES, i),
    target: `Post #${2000 + (i * 3) % 24}`,
    reason: pick(["Spam", "Off-topic", "Abusive language", "Personal attack", "Low-effort post"], i),
    severity: pick(["low", "medium", "high"], i),
    reportedAt: hoursAgo(i * 7 + 2),
    status: pick(["open", "open", "actioned", "dismissed"], i),
  }));
  counts["community.report"] = bulkInsert("community.report", reports);

  /* Party relationships -------------------------------------------------- */
  const entities = [
    { id: "e_gutu", label: "Gutu", kind: "company" },
    ...COMPANIES.slice(0, 9).map((c, i) => ({ id: `e_c_${i}`, label: c.name, kind: "company" })),
    ...contacts.slice(0, 8).map((c, i) => ({ id: `e_p_${i}`, label: c.name, kind: "person" })),
    { id: "e_stripe", label: "Stripe", kind: "vendor" },
    { id: "e_aws", label: "AWS", kind: "vendor" },
    { id: "e_slack", label: "Slack", kind: "vendor" },
    { id: "e_reseller", label: "Globex Reseller", kind: "partner" },
  ];
  counts["party-relationships.entity"] = bulkInsert(
    "party-relationships.entity",
    entities,
  );

  const edges: Record<string, unknown>[] = [];
  let eid = 0;
  const companyEntities = entities.filter((e) => e.kind === "company" && e.id !== "e_gutu");
  for (const c of companyEntities.slice(0, 6)) {
    edges.push({ id: `r_${eid++}`, from: "e_gutu", to: c.id, kind: "customer", strength: 0.8 });
  }
  for (const v of entities.filter((e) => e.kind === "vendor")) {
    edges.push({ id: `r_${eid++}`, from: "e_gutu", to: v.id, kind: "vendor", strength: 0.6 });
  }
  for (const p of entities.filter((e) => e.kind === "person").slice(0, 6)) {
    edges.push({
      id: `r_${eid++}`,
      from: companyEntities[eid % companyEntities.length].id,
      to: p.id,
      kind: "employs",
      strength: 0.9,
    });
  }
  edges.push({
    id: `r_${eid++}`,
    from: "e_gutu",
    to: "e_reseller",
    kind: "partner",
    strength: 0.7,
  });
  counts["party-relationships.relationship"] = bulkInsert(
    "party-relationships.relationship",
    edges,
  );

  return counts;
}
