import { db } from "../db";
import { bulkInsert } from "../lib/query";

const OWNERS = ["sam@gutu.dev", "alex@gutu.dev", "taylor@gutu.dev", "jordan@gutu.dev"];
const PROJECT_NAMES = [
  "Migrate to v2", "Redesign billing", "Launch EU", "Mobile app", "Data warehouse",
  "SOC 2 Type II", "API v3", "Customer portal", "Marketing site refresh", "Analytics pipeline",
];
const FIRST = ["Ada", "Grace", "Linus", "Guido", "Alan", "Donald", "Katherine", "Barbara"];
const LAST = ["Lovelace", "Hopper", "Torvalds", "van Rossum", "Turing", "Knuth", "Johnson", "Liskov"];

const pick = <T>(arr: readonly T[], i: number): T => arr[i % arr.length]!;
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
const code = (p: string, i: number, pad = 4) => `${p}-${String(1000 + i).padStart(pad, "0")}`;
const personName = (i: number) => `${pick(FIRST, i)} ${pick(LAST, i + 2)}`;

const count = (r: string) =>
  (db.prepare("SELECT COUNT(*) AS c FROM records WHERE resource = ?").get(r) as { c: number }).c;
const seedIf = (r: string, rows: Record<string, unknown>[]) =>
  count(r) > 0 ? 0 : bulkInsert(r, rows);

export function seedProjectsExtended(): Record<string, number> {
  const out: Record<string, number> = {};

  out["projects.project"] = seedIf("projects.project", Array.from({ length: 18 }, (_, i) => {
    const budgetHours = 100 + (i * 73) % 900;
    const progressPct = 10 + (i * 7) % 90;
    const actualHours = Math.round((budgetHours * progressPct) / 100);
    const budgetCost = budgetHours * 120;
    const actualCost = actualHours * 125;
    return {
      id: `prj_ext_${i + 1}`,
      code: code("PRJ", i, 4),
      name: pick(PROJECT_NAMES, i),
      owner: pick(OWNERS, i),
      portfolio: pick(["product", "infra", "gtm", "ops"], i),
      status: pick(["in_progress", "in_progress", "in_progress", "open", "resolved"], i),
      priority: pick(["normal", "high", "urgent", "low"], i),
      progressPct,
      riskLevel: pick(["low", "low", "medium", "medium", "high"], i),
      riskScore: 20 + (i * 7) % 80,
      startAt: daysAgo(60 - i * 3),
      dueAt: daysFromNow(30 + i * 3),
      budgetHours,
      actualHours,
      budgetCost,
      actualCost,
      description: "",
    };
  }));

  out["projects.task"] = seedIf("projects.task", Array.from({ length: 80 }, (_, i) => {
    const due = daysFromNow(i % 20 - 5);
    return {
      id: `prj_task_${i + 1}`,
      code: code("TASK", i, 5),
      title: pick([
        "Schema migration plan", "Auth audit", "Update billing webhook",
        "QA sweep", "Refactor dashboards", "Deploy canary",
        "Write docs", "Load test", "Stakeholder review", "Finalize designs",
      ], i),
      projectCode: code("PRJ", i % 18, 4),
      assignee: personName(i),
      status: pick(["todo", "in_progress", "in_progress", "review", "done", "blocked"], i),
      priority: pick(["low", "normal", "high", "urgent"], i),
      estimatedHours: pick([2, 4, 8, 16, 24], i),
      actualHours: pick([0, 2, 4, 8, 12], i),
      storyPoints: pick([1, 2, 3, 5, 8, 13], i),
      sprintCode: code("SPR", Math.floor(i / 15), 4),
      milestoneId: i % 5 === 0 ? `ms_${(i % 10) + 1}` : "",
      parentTaskId: "",
      labels: pick([["feature"], ["bug"], ["chore"], ["doc", "research"], []], i),
      createdAt: daysAgo((i * 7) % 60),
      dueAt: due,
      overdue: Date.parse(due) < Date.now() && i % 4 !== 3,
      description: "",
    };
  }));

  out["projects.milestone"] = seedIf("projects.milestone", Array.from({ length: 16 }, (_, i) => ({
    id: `prj_ms_${i + 1}`,
    name: pick([
      "Alpha release", "Beta release", "GA launch", "Security audit done",
      "Migration complete", "Infra cutover", "Design review", "QA sign-off",
    ], i),
    projectCode: code("PRJ", i % 18, 4),
    dueAt: daysFromNow((i - 3) * 10),
    status: pick(["upcoming", "upcoming", "in-progress", "done", "missed"], i),
    owner: pick(OWNERS, i),
    description: "",
  })));

  out["projects.sprint"] = seedIf("projects.sprint", Array.from({ length: 8 }, (_, i) => ({
    id: `prj_spr_${i + 1}`,
    code: code("SPR", i, 4),
    name: `Sprint ${2026}-${String(i + 1).padStart(2, "0")}`,
    team: pick(["Platform", "Growth", "Infra", "Data"], i),
    startAt: daysAgo(60 - i * 14),
    endAt: daysAgo(60 - i * 14 - 14),
    plannedPoints: 40 + (i * 5),
    completedPoints: 30 + (i * 4 + (i % 3)),
    status: i >= 6 ? "active" : "completed",
    retrospective: "",
  })));

  out["projects.time-log"] = seedIf("projects.time-log", Array.from({ length: 50 }, (_, i) => ({
    id: `prj_tl_${i + 1}`,
    user: pick(OWNERS, i),
    projectCode: code("PRJ", i % 18, 4),
    taskCode: code("TASK", i % 80, 5),
    loggedAt: daysAgo(i * 0.5),
    hours: 0.5 + (i % 8),
    billable: i % 3 !== 0,
    notes: "",
  })));

  out["projects.project-member"] = seedIf("projects.project-member", Array.from({ length: 30 }, (_, i) => ({
    id: `prj_pm_${i + 1}`,
    projectCode: code("PRJ", i % 18, 4),
    user: pick(OWNERS, i),
    role: pick(["owner", "lead", "contributor", "contributor", "reviewer", "stakeholder"], i),
    allocation: pick([25, 50, 75, 100], i),
    joinedAt: daysAgo(60 - (i * 3) % 60),
  })));

  out["projects.risk"] = seedIf("projects.risk", Array.from({ length: 14 }, (_, i) => ({
    id: `prj_rk_${i + 1}`,
    projectCode: code("PRJ", i % 18, 4),
    title: pick(["Vendor delay", "Scope creep", "Key person dependency", "Budget overrun", "Technical debt"], i),
    severity: pick(["low", "medium", "high"], i),
    probability: 10 + (i * 11) % 80,
    impact: pick(["Delayed launch", "Budget overrun", "Customer churn", "Compliance gap"], i),
    mitigation: "Track weekly + escalate if needed.",
    owner: pick(OWNERS, i),
    status: pick(["open", "mitigated", "accepted", "closed"], i),
  })));

  return out;
}
