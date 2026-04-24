import { db } from "../db";
import { bulkInsert } from "../lib/query";

const DEPARTMENTS = ["Engineering", "Sales", "Marketing", "Operations", "Finance", "Support", "HR"];
const CITIES = ["San Francisco", "Seattle", "Austin", "New York", "Boston", "Denver", "Chicago", "Portland", "Miami", "London"];
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

export function seedAssetsExtended(): Record<string, number> {
  const out: Record<string, number> = {};

  out["assets.asset"] = seedIf("assets.asset", Array.from({ length: 40 }, (_, i) => {
    const cost = 500 + ((i * 1097) % 40000);
    const life = pick([3, 5, 7, 10], i);
    const ageYrs = Math.min(life, (i * 2) % (life + 1));
    const salvage = Math.round(cost * 0.1);
    const nbv = Math.max(salvage, Math.round(cost - ((cost - salvage) * ageYrs) / life));
    return {
      id: `ast_ext_${i + 1}`,
      tag: code("AST", i, 5),
      name: pick(["MacBook Pro", "Dell XPS", "Ford Transit", "Forklift", "Scanner", "Desk", "Chair", "Server"], i),
      category: pick(["laptop", "vehicle", "equipment", "machinery", "furniture"], i),
      serialNumber: `SN-${String(100000 + i * 37).slice(-6)}`,
      vendor: pick(["Apple", "Dell", "Ford", "Crown", "Zebra", "Herman Miller"], i),
      modelNumber: pick(["M3 Pro", "XPS 15", "Transit 250", "FC-40", "DS8178"], i),
      location: pick(CITIES, i),
      department: pick(DEPARTMENTS, i),
      assignee: personName(i),
      status: pick(["deployed", "deployed", "deployed", "in_storage", "maintenance", "retired"], i),
      purchasedAt: daysAgo(i * 30),
      warrantyEndsAt: daysFromNow(365 - i * 10),
      nextServiceAt: daysFromNow(30 + (i * 17) % 180),
      usefulLifeYears: life,
      cost,
      salvageValue: salvage,
      netBookValue: nbv,
      depreciationMethod: pick(["straight-line", "double-declining", "units-of-production"], i),
      maintenanceDueSoon: ((i * 17) % 180) < 30,
      notes: "",
    };
  }));

  out["assets.assignment"] = seedIf("assets.assignment", Array.from({ length: 30 }, (_, i) => ({
    id: `ast_asgn_${i + 1}`,
    assetTag: code("AST", i, 5),
    assignee: personName(i),
    department: pick(DEPARTMENTS, i),
    location: pick(CITIES, i),
    assignedAt: daysAgo(60 - i * 2),
    returnedAt: i % 4 === 0 ? daysAgo(i) : "",
    status: i % 4 === 0 ? "returned" : "active",
    notes: "",
  })));

  out["assets.depreciation-entry"] = seedIf("assets.depreciation-entry", Array.from({ length: 48 }, (_, i) => {
    const amount = 100 + (i * 71) % 900;
    return {
      id: `ast_dep_${i + 1}`,
      assetTag: code("AST", i % 40, 5),
      period: `2026-${String(((i % 12) + 1)).padStart(2, "0")}`,
      method: pick(["straight-line", "double-declining"], i),
      amount,
      accumulated: amount * (1 + Math.floor(i / 12)),
      postedAt: daysAgo(i * 3),
    };
  }));

  out["assets.asset-transfer"] = seedIf("assets.asset-transfer", Array.from({ length: 14 }, (_, i) => ({
    id: `ast_tfr_${i + 1}`,
    code: code("TFR", i, 5),
    assetTag: code("AST", i * 2, 5),
    fromLocation: pick(CITIES, i),
    toLocation: pick(CITIES, i + 3),
    fromAssignee: personName(i),
    toAssignee: personName(i + 4),
    reason: pick(["relocation", "reassignment", "maintenance", "retirement"], i),
    transferredAt: daysAgo(i * 10),
    status: pick(["completed", "completed", "in-transit", "pending"], i),
  })));

  out["assets.disposal"] = seedIf("assets.disposal", Array.from({ length: 8 }, (_, i) => {
    const proceeds = pick([100, 500, 0, 1500, 50], i);
    return {
      id: `ast_dsp_${i + 1}`,
      code: code("DSP", i, 5),
      assetTag: code("AST", 30 + i, 5),
      method: pick(["sold", "scrapped", "donated", "lost"], i),
      disposedAt: daysAgo(i * 30),
      proceeds,
      gainLoss: proceeds - (500 + (i * 137) % 1500),
      notes: "",
    };
  }));

  out["assets.audit"] = seedIf("assets.audit", Array.from({ length: 6 }, (_, i) => ({
    id: `ast_aud_${i + 1}`,
    code: code("AAU", i, 5),
    scope: pick(["HQ laptops", "Factory machinery", "All vehicles", "Furniture annual"], i),
    auditor: personName(i),
    conductedAt: daysAgo(i * 60),
    assetsChecked: 20 + (i * 13) % 80,
    missing: i % 5,
    discrepancies: (i * 3) % 15,
    status: pick(["completed", "completed", "in-progress", "planned"], i),
  })));

  return out;
}
