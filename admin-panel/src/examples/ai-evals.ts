import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { daysAgo, pick } from "./_factory/seeds";
import { aiEvalsRunView } from "./ai-evals-pages";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
import type { ReportDefinition, ReportResult } from "@/contracts/widgets";

const controlRoomView = buildCompactControlRoom({
  viewId: "ai-evals.control-room.view",
  resource: "ai-evals.suite",
  title: "AI Evals Control Room",
  description: "Eval suites, runs, regression detection.",
  kpis: [
    { label: "Suites", resource: "ai-evals.suite" },
    { label: "Runs (30d)", resource: "ai-evals.run", range: "last-30" },
    { label: "Regressions", resource: "ai-evals.regression",
      filter: { field: "resolved", op: "eq", value: false } },
    { label: "Avg pass %", resource: "ai-evals.run", fn: "avg", field: "passRate" },
  ],
  charts: [
    { label: "Runs by model", resource: "ai-evals.run", chart: "bar", groupBy: "model" },
    { label: "Runs (30d)", resource: "ai-evals.run", chart: "area", period: "day", lastDays: 30 },
  ],
  shortcuts: [
    { label: "New suite", icon: "Plus", href: "/ai/evals/suites/new" },
    { label: "Run all", icon: "PlayCircle", href: "/ai/evals/runs/new" },
    { label: "Latest run", icon: "FlaskConical", href: "/ai/evals/latest" },
    { label: "Reports", icon: "BarChart3", href: "/ai/evals/reports" },
  ],
});

async function fetchAll(r: import("@/runtime/resourceClient").ResourceClient, resource: string) {
  return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows as Record<string, unknown>[];
}
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

const suitePerformanceReport: ReportDefinition = {
  id: "suite-performance", label: "Suite Performance",
  description: "Pass rate trend per suite.",
  icon: "Activity", resource: "ai-evals.suite", filters: [],
  async execute({ resources }): Promise<ReportResult> {
    const suites = await fetchAll(resources, "ai-evals.suite");
    const rows = suites.map((s) => ({
      name: str(s.name),
      cases: num(s.cases),
      passRate: num(s.passRate),
      lastRun: str(s.lastRun),
    })).sort((a, b) => b.passRate - a.passRate);
    return {
      columns: [
        { field: "name", label: "Suite", fieldtype: "text" },
        { field: "cases", label: "Cases", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "passRate", label: "Pass %", fieldtype: "percent", align: "right" },
        { field: "lastRun", label: "Last run", fieldtype: "datetime" },
      ],
      rows,
    };
  },
};

const { indexView: reportsIndex, detailView: reportsDetail } = buildReportLibrary({
  indexViewId: "ai-evals.reports.view",
  detailViewId: "ai-evals.reports-detail.view",
  resource: "ai-evals.suite",
  title: "AI Evals Reports",
  description: "Suite performance.",
  basePath: "/ai/evals/reports",
  reports: [suitePerformanceReport],
});

export const aiEvalsPlugin = buildDomainPlugin({
  id: "ai-evals",
  label: "AI Evals",
  icon: "FlaskConical",
  section: SECTIONS.ai,
  order: 2,
  resources: [
    {
      id: "suite",
      singular: "Eval Suite",
      plural: "Eval Suites",
      icon: "TestTube",
      path: "/ai/evals/suites",
      fields: [
        { name: "name", kind: "text", required: true, sortable: true },
        { name: "description", kind: "text" },
        { name: "cases", kind: "number", align: "right", sortable: true },
        { name: "passRate", label: "Pass %", kind: "number", align: "right", sortable: true },
        { name: "lastRun", kind: "datetime", sortable: true },
        { name: "active", kind: "boolean" },
      ],
      seedCount: 12,
      seed: (i) => ({
        name: pick(["regression-core", "tone-check", "refusal-rate", "fact-recall", "instruction-follow", "code-quality", "safety"], i),
        description: "",
        cases: 40 + ((i * 7) % 120),
        passRate: 72 + ((i * 13) % 27),
        lastRun: daysAgo(i),
        active: true,
      }),
    },
    {
      id: "case",
      singular: "Eval Case",
      plural: "Eval Cases",
      icon: "FileText",
      path: "/ai/evals/cases",
      fields: [
        { name: "id", kind: "text" },
        { name: "suite", kind: "text", sortable: true },
        { name: "input", kind: "text" },
        { name: "expectedOutput", kind: "text" },
        { name: "category", kind: "text" },
        { name: "weight", kind: "number", align: "right" },
      ],
      seedCount: 30,
      seed: (i) => ({
        id: `case_${i + 1}`,
        suite: pick(["regression-core", "tone-check", "refusal-rate"], i),
        input: `Test input ${i + 1}`,
        expectedOutput: `Expected ${i + 1}`,
        category: pick(["functional", "safety", "quality"], i),
        weight: pick([1, 2, 3, 5], i),
      }),
    },
    {
      id: "run",
      singular: "Run",
      plural: "Runs",
      icon: "PlayCircle",
      path: "/ai/evals/runs",
      displayField: "id",
      readOnly: true,
      defaultSort: { field: "startedAt", dir: "desc" },
      fields: [
        { name: "suite", kind: "text", sortable: true },
        { name: "model", kind: "text", sortable: true },
        { name: "startedAt", kind: "datetime", sortable: true },
        { name: "completedAt", kind: "datetime" },
        { name: "passed", kind: "number", align: "right" },
        { name: "failed", kind: "number", align: "right" },
        { name: "passRate", label: "Pass %", kind: "number", align: "right", sortable: true },
        { name: "durationSec", label: "Duration (s)", kind: "number", align: "right" },
        { name: "triggeredBy", kind: "text" },
      ],
      seedCount: 30,
      seed: (i) => {
        const passRate = 72 + ((i * 11) % 28);
        const total = 40 + (i * 3) % 60;
        const passed = Math.round((total * passRate) / 100);
        return {
          suite: pick(["regression-core", "tone-check", "refusal-rate"], i),
          model: pick(["claude-opus-4-7", "claude-sonnet-4-6", "gpt-4o"], i),
          startedAt: daysAgo(i),
          completedAt: daysAgo(i - 0.01),
          passed,
          failed: total - passed,
          passRate,
          durationSec: 90 + ((i * 29) % 600),
          triggeredBy: pick(["sam@gutu.dev", "ci", "schedule"], i),
        };
      },
    },
    {
      id: "regression",
      singular: "Regression",
      plural: "Regressions",
      icon: "AlertTriangle",
      path: "/ai/evals/regressions",
      defaultSort: { field: "detectedAt", dir: "desc" },
      fields: [
        { name: "code", kind: "text", required: true, sortable: true },
        { name: "suite", kind: "text", required: true },
        { name: "model", kind: "text" },
        { name: "before", kind: "number", align: "right" },
        { name: "after", kind: "number", align: "right" },
        { name: "delta", kind: "number", align: "right" },
        { name: "detectedAt", kind: "datetime", sortable: true },
        { name: "resolved", kind: "boolean" },
      ],
      seedCount: 8,
      seed: (i) => {
        const before = 90 + i;
        const after = before - (i * 2 + 3);
        return {
          code: `REG-${String(100 + i).slice(-3)}`,
          suite: pick(["regression-core", "tone-check", "refusal-rate"], i),
          model: pick(["claude-opus-4-7", "gpt-4o"], i),
          before,
          after,
          delta: after - before,
          detectedAt: daysAgo(i),
          resolved: i > 4,
        };
      },
    },
  ],
  extraNav: [
    { id: "ai-evals.control-room.nav", label: "AI Evals Control Room", icon: "LayoutDashboard", path: "/ai/evals/control-room", view: "ai-evals.control-room.view", order: 0 },
    { id: "ai-evals.reports.nav", label: "Reports", icon: "BarChart3", path: "/ai/evals/reports", view: "ai-evals.reports.view" },
    { id: "ai-evals.run-detail.nav", label: "Latest run", icon: "FlaskConical", path: "/ai/evals/latest", view: "ai-evals.run-detail.view" },
  ],
  extraViews: [controlRoomView, reportsIndex, reportsDetail, aiEvalsRunView],
  commands: [
    { id: "evals.go.control-room", label: "Evals: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/ai/evals/control-room"; } },
    { id: "evals.run", label: "Run eval suite", icon: "PlayCircle", run: () => { window.location.hash = "/ai/evals/runs/new"; } },
  ],
});
