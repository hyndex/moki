import { db } from "../db";
import { bulkInsert } from "../lib/query";

const PRODUCTS = ["Widget A", "Gizmo B", "Part C", "Bracket D", "Motor E", "Sensor F"];
const SUPPLIERS = ["Acme Supply", "Globex Parts", "Initech Components", "Umbrella Hardware"];
const DEFECT_TYPES = ["Dimensional", "Surface finish", "Functional", "Material", "Assembly", "Packaging"];
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

export function seedQualityExtended(): Record<string, number> {
  const out: Record<string, number> = {};

  out["quality.inspection"] = seedIf("quality.inspection", Array.from({ length: 30 }, (_, i) => {
    const result = pick(["pass", "pass", "pass", "fail", "conditional"], i);
    const sampleSize = 20 + (i * 7) % 200;
    const defectsFound = result === "pass" ? 0 : 1 + (i % 5);
    return {
      id: `q_ins_ext_${i + 1}`,
      code: code("QA", i, 5),
      product: pick(PRODUCTS, i),
      batchCode: `BTH-${String(10000 + i).slice(-5)}`,
      inspector: personName(i),
      inspectionType: pick(["incoming", "in-process", "final", "customer-return"], i),
      result,
      severity: pick(["info", "warn", "error"], i),
      passRate: result === "pass" ? 100 : Math.round(((sampleSize - defectsFound) / sampleSize) * 100),
      sampleSize,
      defectsFound,
      status: pick(["open", "resolved"], i),
      inspectedAt: daysAgo(i),
      notes: "",
    };
  }));

  out["quality.ncr"] = seedIf("quality.ncr", Array.from({ length: 14 }, (_, i) => ({
    id: `q_ncr_${i + 1}`,
    code: code("NCR", i, 5),
    title: pick(["Dimension out of tolerance", "Surface finish variation", "Functional test failure", "Material certification missing", "Packaging damaged on receipt"], i),
    product: pick(PRODUCTS, i),
    batchCode: `BTH-${String(10000 + i).slice(-5)}`,
    severity: pick(["info", "warn", "error"], i),
    rootCause: pick(["Machine wear", "Operator error", "Material defect", "Supplier issue", "Unknown"], i),
    disposition: pick(["rework", "scrap", "use-as-is", "return"], i),
    openedBy: personName(i),
    openedAt: daysAgo(i * 2),
    closedAt: i % 3 === 0 ? daysAgo(i) : "",
    status: pick(["open", "investigating", "contained", "closed"], i),
    capaId: i % 3 === 0 ? `CAPA-${String(1000 + i).slice(-4)}` : "",
    costImpact: 100 + (i * 317) % 5000,
  })));

  out["quality.capa"] = seedIf("quality.capa", Array.from({ length: 12 }, (_, i) => ({
    id: `q_capa_${i + 1}`,
    code: `CAPA-${String(1000 + i).slice(-4)}`,
    title: pick(["Tighten drill bit calibration", "Update SOP for assembly", "Supplier requalification", "Revise inspection checklist", "Operator retraining", "Tooling replacement"], i),
    kind: pick(["corrective", "preventive"], i),
    ncrId: code("NCR", i, 5),
    owner: personName(i),
    rootCauseAnalysis: "5-whys analysis concluded…",
    actionPlan: "Step 1…",
    openedAt: daysAgo(i * 7),
    dueAt: daysFromNow(30 - i),
    closedAt: i % 3 === 0 ? daysAgo(i * 2) : "",
    verified: i % 3 === 0,
    status: pick(["in-progress", "in-progress", "implemented", "verified", "closed"], i),
  })));

  out["quality.defect"] = seedIf("quality.defect", Array.from({ length: 40 }, (_, i) => ({
    id: `q_def_${i + 1}`,
    code: code("DEF", i, 6),
    inspectionCode: code("QA", i % 30, 5),
    product: pick(PRODUCTS, i),
    batchCode: `BTH-${String(10000 + i).slice(-5)}`,
    defectType: pick(DEFECT_TYPES, i),
    severity: pick(["info", "warn", "error"], i),
    supplier: pick(SUPPLIERS, i),
    qty: 1 + (i % 10),
    cost: 50 + (i * 37) % 1000,
    detectedAt: daysAgo(i * 0.5),
  })));

  out["quality.audit"] = seedIf("quality.audit", Array.from({ length: 10 }, (_, i) => ({
    id: `q_aud_${i + 1}`,
    code: code("AUD", i, 5),
    title: pick(["ISO 9001 surveillance", "Internal process audit", "Supplier qualification audit", "Customer walk-through", "FDA pre-inspection", "AS9100 gap audit"], i),
    kind: pick(["internal", "supplier", "customer", "regulatory", "certification"], i),
    auditor: personName(i),
    auditee: pick(["Production", "Engineering", "Supplier A", "Supplier B"], i),
    severity: pick(["info", "warn", "error"], i),
    conductedAt: daysAgo(i * 20),
    findingsCount: (i * 3) % 12,
    status: pick(["completed", "completed", "in-progress", "closed", "planned"], i),
  })));

  out["quality.calibration"] = seedIf("quality.calibration", Array.from({ length: 12 }, (_, i) => ({
    id: `q_cal_${i + 1}`,
    code: code("CAL", i, 5),
    instrumentId: `INS-${String(100 + i).padStart(4, "0")}`,
    instrumentType: pick(["caliper", "micrometer", "gauge", "scale", "cmm", "thermometer"], i),
    lastCalibratedAt: daysAgo(180 - i * 20),
    nextDueAt: daysFromNow(180 - i * 20),
    calibratedBy: personName(i),
    passed: i % 6 !== 5,
    status: i < 8 ? "in-spec" : i < 10 ? "due" : "overdue",
  })));

  return out;
}
