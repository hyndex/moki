import { db } from "../db";
import { bulkInsert } from "../lib/query";

const PRODUCTS = ["Widget A", "Gizmo B", "Part C", "Bracket D", "Motor E", "Sensor F"];
const OPERATORS = ["Sam Hopper", "Alex Knuth", "Taylor Turing", "Jordan Hamilton", "Casey Pappas"];

const pick = <T>(arr: readonly T[], i: number): T => arr[i % arr.length]!;
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
const code = (p: string, i: number, pad = 4) => `${p}-${String(1000 + i).padStart(pad, "0")}`;
const money = (i: number, base = 100, spread = 5000) =>
  Math.round(base + ((i * 97 + 13) % spread) * 100) / 100;

const count = (r: string) =>
  (db.prepare("SELECT COUNT(*) AS c FROM records WHERE resource = ?").get(r) as { c: number }).c;
const seedIf = (r: string, rows: Record<string, unknown>[]) =>
  count(r) > 0 ? 0 : bulkInsert(r, rows);

export function seedManufacturingExtended(): Record<string, number> {
  const out: Record<string, number> = {};

  out["manufacturing.order"] = seedIf("manufacturing.order", Array.from({ length: 30 }, (_, i) => {
    const qty = 100 + ((i * 43) % 900);
    const completed = i % 3 === 2 ? qty : Math.round(qty * 0.7);
    const scrap = Math.round(qty * 0.03);
    return {
      id: `mfg_mo_ext_${i + 1}`,
      code: code("MO", i, 6),
      product: pick(PRODUCTS, i),
      bomCode: code("BOM", i % 6, 4),
      routingCode: code("RTG", i % 4, 4),
      workCenter: pick(["WC-ASM-1", "WC-ASM-2", "WC-MACH-1", "WC-PACK-1"], i),
      operator: pick(OPERATORS, i),
      priority: pick(["low", "normal", "high"], i),
      quantity: qty,
      completedQty: completed,
      wipQty: qty - completed - scrap,
      scrapQty: scrap,
      scrapRatePct: Math.round((scrap / qty) * 100),
      unitCost: 10 + ((i * 7) % 80),
      status: pick(["open", "in_progress", "resolved"], i),
      startAt: daysAgo(i - 5),
      dueAt: daysFromNow(i % 20 - 3),
      completedAt: i % 3 === 2 ? daysAgo(i - 6) : "",
    };
  }));

  out["manufacturing.bom"] = seedIf("manufacturing.bom", Array.from({ length: 10 }, (_, i) => {
    const mat = money(i, 20, 400);
    const lab = money(i + 1, 10, 200);
    const ovh = Math.round((mat + lab) * 0.15);
    return {
      id: `mfg_bom_${i + 1}`,
      code: code("BOM", i, 4),
      product: pick(PRODUCTS, i),
      version: `v${1 + (i % 5)}`,
      quantity: 1 + (i % 5),
      itemsCount: 3 + (i % 12),
      materialCost: mat,
      laborCost: lab,
      overheadCost: ovh,
      totalCost: mat + lab + ovh,
      active: i !== 9,
    };
  }));

  out["manufacturing.routing"] = seedIf("manufacturing.routing", Array.from({ length: 6 }, (_, i) => ({
    id: `mfg_rtg_${i + 1}`,
    code: code("RTG", i, 4),
    name: pick(["Assembly routing", "Machining routing", "Pack + ship", "QA routing", "Rework routing"], i),
    product: pick(PRODUCTS, i),
    operationsCount: 2 + (i % 6),
    totalMinutes: 30 + (i * 15) % 240,
    active: i !== 5,
  })));

  out["manufacturing.work-center"] = seedIf("manufacturing.work-center", Array.from({ length: 8 }, (_, i) => ({
    id: `mfg_wc_${i + 1}`,
    code: pick(["WC-ASM-1", "WC-ASM-2", "WC-MACH-1", "WC-MACH-2", "WC-WELD-1", "WC-PACK-1", "WC-QA-1", "WC-REWORK-1"], i),
    name: pick(["Assembly Line 1", "Assembly Line 2", "Machining Cell 1", "Machining Cell 2", "Welding Bay", "Packing Line", "QA Cell", "Rework Station"], i),
    kind: pick(["assembly", "assembly", "machining", "machining", "welding", "packaging", "qa", "assembly"], i),
    location: pick(["Plant A", "Plant A", "Plant B", "Plant B"], i),
    capacityHrs: 40 * (1 + (i % 3)),
    scheduledHrs: 30 + (i * 4) % 40,
    hourlyRate: 60 + (i * 5) % 40,
    status: i === 7 ? "inactive" : "active",
  })));

  out["manufacturing.operation"] = seedIf("manufacturing.operation", Array.from({ length: 20 }, (_, i) => ({
    id: `mfg_op_${i + 1}`,
    code: code("OP", i, 5),
    routingCode: code("RTG", i % 6, 4),
    sequence: (i % 10) + 10,
    name: pick(["Cut", "Drill", "Assemble", "Weld", "Sand", "Paint", "Test", "Pack", "Label", "Inspect"], i),
    workCenter: pick(["WC-ASM-1", "WC-ASM-2", "WC-MACH-1", "WC-PACK-1"], i),
    setupMinutes: 5 + (i % 10),
    runMinutesPerUnit: 0.5 + (i * 0.1) % 3,
    active: true,
  })));

  out["manufacturing.material-consumption"] = seedIf("manufacturing.material-consumption", Array.from({ length: 30 }, (_, i) => {
    const planned = 10 + (i * 3) % 50;
    const actual = planned + ((i % 3) - 1);
    const unitCost = 5 + (i * 2) % 50;
    return {
      id: `mfg_mc_${i + 1}`,
      orderCode: code("MO", i % 30, 6),
      itemSku: `SKU-${String(1000 + i).slice(-5)}`,
      itemName: pick(["Raw Steel", "Bolt M8", "Wire Harness", "Paint", "Solder", "Foam Insert"], i),
      plannedQty: planned,
      actualQty: actual,
      unitCost,
      totalCost: actual * unitCost,
      consumedAt: daysAgo(i),
    };
  }));

  out["manufacturing.job-card"] = seedIf("manufacturing.job-card", Array.from({ length: 24 }, (_, i) => {
    const planned = 30 + (i * 5) % 120;
    const actual = planned + ((i * 3) % 30) - 15;
    return {
      id: `mfg_jc_${i + 1}`,
      code: code("JC", i, 5),
      orderCode: code("MO", i % 30, 6),
      operation: pick(["Cut", "Drill", "Assemble", "Weld", "Test", "Pack"], i),
      operator: pick(OPERATORS, i),
      workCenter: pick(["WC-ASM-1", "WC-ASM-2", "WC-MACH-1", "WC-PACK-1"], i),
      startedAt: daysAgo(i),
      completedAt: daysAgo(i - 0.2),
      plannedMinutes: planned,
      actualMinutes: actual,
      efficiency: Math.round((planned / Math.max(actual, 1)) * 100),
      status: pick(["resolved", "resolved", "in_progress"], i),
    };
  }));

  return out;
}
