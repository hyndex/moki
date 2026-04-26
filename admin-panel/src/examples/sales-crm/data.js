/** Shared seed data for the Sales & CRM category. Deterministic generators
 *  so every page pulls from the same coherent "world" of data.             */
export const REP_NAMES = [
    "Sam Rivera",
    "Alex Chen",
    "Taylor Nguyen",
    "Jordan Park",
    "Casey Morgan",
    "Morgan Davis",
    "Riley Kim",
];
export const FIRSTS = [
    "Ada", "Grace", "Linus", "Guido", "Alan", "Donald", "Katherine",
    "Barbara", "Margaret", "Anita", "Radia", "Shafi", "Leslie", "Dennis",
    "Edsger", "Tim", "John", "Bjarne", "Niklaus", "Carol", "Dana", "Hedy", "Elena",
];
export const LASTS = [
    "Lovelace", "Hopper", "Torvalds", "van Rossum", "Turing", "Knuth",
    "Johnson", "Liskov", "Hamilton", "Borg", "Perlman", "Goldwasser",
    "Lamport", "Ritchie", "Dijkstra", "Berners-Lee", "McCarthy", "Shamir",
];
export const COMPANIES = [
    { name: "Acme Corp", domain: "acme.com", industry: "saas", size: 540 },
    { name: "Globex", domain: "globex.io", industry: "retail", size: 210 },
    { name: "Initech", domain: "initech.dev", industry: "software", size: 1200 },
    { name: "Umbrella Co", domain: "umbrella.com", industry: "pharma", size: 3400 },
    { name: "Hooli", domain: "hooli.com", industry: "saas", size: 8800 },
    { name: "Pied Piper", domain: "piedpiper.com", industry: "saas", size: 45 },
    { name: "Dunder Mifflin", domain: "dundermifflin.com", industry: "paper", size: 180 },
    { name: "Stark Industries", domain: "stark.com", industry: "manufacturing", size: 24000 },
    { name: "Wayne Enterprises", domain: "wayne.com", industry: "manufacturing", size: 18000 },
    { name: "Cyberdyne", domain: "cyberdyne.dev", industry: "ai", size: 620 },
    { name: "Tyrell Corp", domain: "tyrell.ai", industry: "ai", size: 420 },
    { name: "Weyland", domain: "weyland.co", industry: "aerospace", size: 5200 },
    { name: "Massive Dynamic", domain: "massivedynamic.com", industry: "saas", size: 980 },
    { name: "Oscorp", domain: "oscorp.biz", industry: "biotech", size: 740 },
    { name: "Daily Planet", domain: "dailyplanet.com", industry: "media", size: 320 },
    { name: "LexCorp", domain: "lexcorp.com", industry: "energy", size: 3100 },
    { name: "Nakatomi", domain: "nakatomi.com", industry: "real-estate", size: 480 },
    { name: "Aperture Science", domain: "aperture.sci", industry: "research", size: 210 },
];
export const STAGES = [
    { id: "lead", label: "Lead", intent: "neutral", probability: 0.1 },
    { id: "prospect", label: "Prospect", intent: "info", probability: 0.25 },
    { id: "customer", label: "Customer", intent: "success", probability: 1.0 },
    { id: "churned", label: "Churned", intent: "danger", probability: 0 },
];
export const DEAL_STAGES = [
    { id: "qualify", label: "Qualify", intent: "neutral", probability: 0.1 },
    { id: "proposal", label: "Proposal", intent: "info", probability: 0.35 },
    { id: "negotiate", label: "Negotiate", intent: "warning", probability: 0.65 },
    { id: "won", label: "Closed Won", intent: "success", probability: 1.0 },
    { id: "lost", label: "Closed Lost", intent: "danger", probability: 0 },
];
/* ------------------------------------------------------------------------ */
const TAGS = ["vip", "enterprise", "growth", "strategic", "free-tier", "overdue", "new"];
function hoursAgoIso(h) {
    return new Date(Date.now() - h * 3600_000).toISOString();
}
function daysAgoIso(d) {
    return new Date(Date.now() - d * 86400_000).toISOString();
}
function pick(arr, i) {
    return arr[Math.abs(i) % arr.length];
}
/* Contacts ---------------------------------------------------------------- */
export const CONTACTS = Array.from({ length: 44 }, (_, i) => {
    const f = pick(FIRSTS, i);
    const l = pick(LASTS, i + 5);
    const company = pick(COMPANIES, i);
    const stage = pick(STAGES, i).id;
    const vip = i % 7 === 0;
    const lastActivityDays = (i * 2 + 1) % 40;
    return {
        id: `ct_${i + 100}`,
        firstName: f,
        lastName: l,
        name: `${f} ${l}`,
        title: pick(["VP Eng", "CTO", "CEO", "Head of Ops", "COO", "Product Lead", "Director"], i),
        company: company.name,
        email: `${f.toLowerCase()}.${l.toLowerCase().replace(/\s+/g, "")}@${company.domain}`,
        phone: `+1 555 ${String(100 + i).padStart(3, "0")} ${String(1000 + i * 7).slice(-4)}`,
        stage,
        owner: pick(REP_NAMES, i),
        vip,
        lifetimeValue: 500 + ((i * 911) % 85_000),
        createdAt: daysAgoIso(30 + (i * 3) % 400),
        lastActivityAt: daysAgoIso(lastActivityDays),
        activityTrend: Array.from({ length: 12 }, (_, j) => 2 + ((j + i) * 3) % 14),
        tags: [TAGS[i % TAGS.length], ...(vip ? ["vip"] : [])].filter((t, idx, a) => a.indexOf(t) === idx),
    };
});
/* Deals ------------------------------------------------------------------- */
export const DEALS = Array.from({ length: 28 }, (_, i) => {
    const stage = pick(DEAL_STAGES, i + 1).id;
    const stageDef = DEAL_STAGES.find((s) => s.id === stage);
    const company = pick(COMPANIES, i + 2);
    const contact = CONTACTS[i % CONTACTS.length];
    const closeOffset = i % 3 === 0 ? -i : 30 - i * 2;
    const amount = 5_000 + ((i * 9137) % 180_000);
    return {
        id: `dl_${500 + i}`,
        code: `D-${2000 + i}`,
        name: `${company.name} — ${pick(["expansion", "renewal", "new logo", "upsell", "pilot"], i)}`,
        account: company.name,
        contact: contact.name,
        owner: pick(REP_NAMES, i + 1),
        stage,
        amount,
        probability: stageDef.probability,
        closeAt: daysAgoIso(-closeOffset),
        createdAt: daysAgoIso(60 + (i * 2) % 300),
        updatedAt: daysAgoIso((i * 3) % 40),
    };
});
/* Quotes ------------------------------------------------------------------ */
export const QUOTES = Array.from({ length: 18 }, (_, i) => ({
    id: `q_${800 + i}`,
    number: `Q-${3000 + i}`,
    account: pick(COMPANIES, i + 4).name,
    amount: 4_000 + ((i * 7919) % 60_000),
    status: pick(["draft", "sent", "accepted", "expired"], i),
    expiresAt: daysAgoIso(-7 + (i * 3) % 60),
}));
/* Activity ---------------------------------------------------------------- */
export const ACTIVITIES = Array.from({ length: 48 }, (_, i) => {
    const kind = ["email", "call", "meeting", "note", "task"][i % 5];
    const contact = CONTACTS[i % CONTACTS.length];
    const SUMMARIES = {
        email: [
            `Emailed ${contact.name} about pricing options`,
            `Replied to inbound from ${contact.name}`,
            `Sent proposal to ${contact.name}`,
        ],
        call: [
            `Discovery call with ${contact.name} — 24 min`,
            `Left voicemail for ${contact.name}`,
            `Follow-up call with ${contact.name}`,
        ],
        meeting: [
            `Demo with ${contact.name} and team`,
            `Quarterly review with ${contact.name}`,
            `Kick-off with ${contact.name}`,
        ],
        note: [
            `Noted: ${contact.name} is renewing early`,
            `Noted: ${contact.name} flagged a concern`,
            `Noted: ${contact.name} approved scope`,
        ],
        task: [
            `Send ${contact.name} the security questionnaire`,
            `Draft SOW for ${contact.name}`,
            `Schedule next check-in with ${contact.name}`,
        ],
    };
    return {
        id: `act_${1000 + i}`,
        kind,
        contactId: contact.id,
        contactName: contact.name,
        summary: pick(SUMMARIES[kind], i),
        body: kind === "note" ? "They want annual billing and multi-region." : undefined,
        when: hoursAgoIso(i * 3 + 0.5),
        rep: pick(REP_NAMES, i),
    };
});
/* Community --------------------------------------------------------------- */
export const SPACES = [
    { id: "sp_gen", name: "General", handle: "general", description: "Workspace-wide announcements and chat.", members: 842, posts: 4320, visibility: "public", lastActive: hoursAgoIso(0.3), color: "rgb(var(--accent))" },
    { id: "sp_sup", name: "Support", handle: "support", description: "Customer support threads and internal triage.", members: 184, posts: 1892, visibility: "public", lastActive: hoursAgoIso(1.2), color: "rgb(var(--intent-info))" },
    { id: "sp_fb", name: "Feedback", handle: "feedback", description: "Product feedback, feature requests, roadmap chatter.", members: 641, posts: 892, visibility: "public", lastActive: hoursAgoIso(2.1), color: "rgb(var(--intent-success))" },
    { id: "sp_launch", name: "Launch Room", handle: "launch", description: "Coordination for upcoming launches.", members: 42, posts: 310, visibility: "private", lastActive: hoursAgoIso(4), color: "rgb(var(--intent-warning))" },
    { id: "sp_ptr", name: "Partners", handle: "partners", description: "Channel + strategic partner discussions.", members: 96, posts: 512, visibility: "private", lastActive: daysAgoIso(1), color: "rgb(var(--intent-danger))" },
    { id: "sp_eng", name: "Engineering", handle: "engineering", description: "Internal engineering discussion.", members: 72, posts: 2210, visibility: "private", lastActive: hoursAgoIso(0.1), color: "rgb(var(--text-muted))" },
];
export const POSTS = Array.from({ length: 24 }, (_, i) => {
    const space = pick(SPACES, i);
    const author = pick(CONTACTS, i).name;
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
        "Check out the full changelog for the details. Highlights: universal admin, command palette, and ⌘K search.",
        "I'd love to filter by multiple stages at once — maybe a multi-select chip bar?",
        "Getting a blank file when I export > 10k rows. Reproduced on both Safari and Chrome.",
        "Rolling out a Gutu workspace to a new team next week. Any tips?",
        "We're expanding the platform team. Remote-friendly, full-time.",
        "New tiers for our partner program go live next month.",
        "Planning Q3 now — what should we prioritize?",
    ];
    return {
        id: `p_${2000 + i}`,
        author,
        space: space.name,
        title: pick(TITLES, i),
        body: pick(BODIES, i),
        createdAt: hoursAgoIso(i * 4 + 1),
        replies: (i * 3) % 34,
        likes: (i * 7) % 120,
        pinned: i === 0 || i === 2,
    };
});
export const MODERATION = Array.from({ length: 7 }, (_, i) => ({
    id: `m_${3000 + i}`,
    reportedBy: pick(REP_NAMES, i),
    target: `Post #${2000 + (i * 3) % 24}`,
    reason: pick(["Spam", "Off-topic", "Abusive language", "Personal attack", "Low-effort post"], i),
    severity: pick(["low", "medium", "high"], i),
    reportedAt: hoursAgoIso(i * 7 + 2),
    status: pick(["open", "open", "actioned", "dismissed"], i),
}));
/* Party relationships ----------------------------------------------------- */
export const ENTITIES = [
    { id: "e_gutu", label: "Gutu", kind: "company" },
    ...COMPANIES.slice(0, 9).map((c, i) => ({
        id: `e_c_${i}`,
        label: c.name,
        kind: "company",
    })),
    ...CONTACTS.slice(0, 8).map((c, i) => ({
        id: `e_p_${i}`,
        label: c.name,
        kind: "person",
    })),
    { id: "e_stripe", label: "Stripe", kind: "vendor" },
    { id: "e_aws", label: "AWS", kind: "vendor" },
    { id: "e_slack", label: "Slack", kind: "vendor" },
    { id: "e_reseller", label: "Globex Reseller", kind: "partner" },
];
const KINDS = ["employs", "partner", "vendor", "customer"];
export const EDGES = (() => {
    const edges = [];
    let id = 0;
    const gutuCustomers = ENTITIES.filter((e) => e.kind === "company" && e.id !== "e_gutu");
    for (const c of gutuCustomers.slice(0, 6)) {
        edges.push({ id: `r_${id++}`, from: "e_gutu", to: c.id, kind: "customer", strength: 0.8 });
    }
    for (const v of ENTITIES.filter((e) => e.kind === "vendor")) {
        edges.push({ id: `r_${id++}`, from: "e_gutu", to: v.id, kind: "vendor", strength: 0.6 });
    }
    for (const p of ENTITIES.filter((e) => e.kind === "person").slice(0, 6)) {
        const employer = gutuCustomers[id % gutuCustomers.length];
        edges.push({ id: `r_${id++}`, from: employer.id, to: p.id, kind: "employs", strength: 0.9 });
    }
    edges.push({
        id: `r_${id++}`,
        from: "e_gutu",
        to: "e_reseller",
        kind: "partner",
        strength: 0.7,
    });
    for (let i = 0; i < 4; i++) {
        const a = ENTITIES[(i + 3) % ENTITIES.length];
        const b = ENTITIES[(i + 7) % ENTITIES.length];
        if (a.id !== b.id)
            edges.push({
                id: `r_${id++}`,
                from: a.id,
                to: b.id,
                kind: KINDS[i % KINDS.length],
                strength: 0.4 + (i % 3) * 0.2,
            });
    }
    return edges;
})();
/* Helpers ---------------------------------------------------------------- */
export function stageLabel(id) {
    return STAGES.find((s) => s.id === id)?.label ?? id;
}
export function dealStageLabel(id) {
    return DEAL_STAGES.find((s) => s.id === id)?.label ?? id;
}
export function dealStageIntent(id) {
    return DEAL_STAGES.find((s) => s.id === id)?.intent ?? "neutral";
}
export function stageIntent(id) {
    return STAGES.find((s) => s.id === id)?.intent ?? "neutral";
}
