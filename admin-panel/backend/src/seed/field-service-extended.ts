import { db } from "../db";
import { bulkInsert } from "../lib/query";

/** Backend seed for extended Field Service resources. Idempotent. */

const TECHS = ["Taylor Turing", "Jordan Hamilton", "Casey Pappas", "Morgan Liskov", "Riley Perlman", "Dakota Shamir", "Sam Hopper", "Alex Knuth"];
const CITIES = ["San Francisco", "Seattle", "Austin", "New York", "Boston", "Denver", "Chicago", "Portland", "Miami", "London"];
const FIRST = ["Ada", "Grace", "Linus", "Guido", "Alan", "Donald", "Katherine", "Barbara", "Margaret"];
const LAST = ["Lovelace", "Hopper", "Torvalds", "van Rossum", "Turing", "Knuth", "Johnson", "Liskov", "Hamilton"];

const pick = <T>(arr: readonly T[], i: number): T => arr[i % arr.length]!;
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
const code = (p: string, i: number, pad = 4) => `${p}-${String(1000 + i).padStart(pad, "0")}`;
const personName = (i: number) => `${pick(FIRST, i)} ${pick(LAST, i + 2)}`;

const count = (r: string) =>
  (db.prepare("SELECT COUNT(*) AS c FROM records WHERE resource = ?").get(r) as { c: number }).c;
const seedIf = (r: string, rows: Record<string, unknown>[]) =>
  count(r) > 0 ? 0 : bulkInsert(r, rows);

export function seedFieldServiceExtended(): Record<string, number> {
  const out: Record<string, number> = {};

  out["field-service.job"] = seedIf("field-service.job", Array.from({ length: 40 }, (_, i) => {
    const scheduled = daysAgo(i - 10);
    const isCompleted = i % 3 === 2;
    return {
      id: `fs_job_ext_${i + 1}`,
      code: code("FS", i, 6),
      customer: pick(["Acme Corp", "Globex", "Initech", "Hooli", "Pied Piper"], i),
      contactPhone: `+1-555-${String(2000 + i).slice(-4)}`,
      serviceType: pick(["install", "repair", "maintenance", "inspection", "emergency"], i),
      assetCode: `AST-${String(10000 + i).slice(-5)}`,
      technician: pick(TECHS, i),
      team: pick(["North", "South", "East", "West"], i),
      location: pick(CITIES, i),
      address: pick(["100 Main St", "200 Market Ave", "300 Industrial Way"], i),
      city: pick(CITIES, i),
      priority: pick(["low", "normal", "high", "urgent"], i),
      status: pick(["open", "in_progress", "resolved"], i),
      scheduledAt: scheduled,
      arrivedAt: isCompleted ? scheduled : "",
      completedAt: isCompleted ? daysAgo(i - 11) : "",
      estimatedHours: pick([1, 2, 3, 4, 6], i),
      actualHours: isCompleted ? pick([1, 2, 3, 4, 5], i) : 0,
      travelKm: 10 + (i * 7) % 80,
      visits: isCompleted ? (i % 2 === 0 ? 1 : 2) : 0,
      slaBreached: i % 9 === 0,
      overdue: !isCompleted && i % 5 === 0,
      reportedIssue: pick(
        ["Unit won't start", "Intermittent noise", "Water leak", "Loose wiring", "Routine check"],
        i,
      ),
      resolutionNotes: isCompleted ? "Replaced faulty part, tested, signed off by customer." : "",
    };
  }));

  out["field-service.technician"] = seedIf("field-service.technician", Array.from({ length: 8 }, (_, i) => ({
    id: `fs_tec_${i + 1}`,
    code: code("TEC", i, 4),
    name: pick(TECHS, i),
    email: `${pick(TECHS, i).toLowerCase().replace(/\s+/g, ".")}@gutu.dev`,
    phone: `+1-555-${String(3000 + i).slice(-4)}`,
    team: pick(["North", "South", "East", "West"], i),
    skills: pick([
      ["electrical", "hvac"],
      ["plumbing"],
      ["mechanical", "electrical"],
      ["software"],
      ["hvac", "mechanical"],
    ], i),
    certifications: pick(["EPA 608", "OSHA 30", "NATE Certified", "None"], i),
    homeCity: pick(CITIES, i),
    vehicleCode: `VAN-${String(i + 1).padStart(2, "0")}`,
    status: pick(["on-duty", "on-duty", "on-duty", "off-duty", "on-break"], i),
    activeJobs: 2 + (i % 5),
  })));

  out["field-service.vehicle"] = seedIf("field-service.vehicle", Array.from({ length: 8 }, (_, i) => ({
    id: `fs_veh_${i + 1}`,
    code: `VAN-${String(i + 1).padStart(2, "0")}`,
    make: pick(["Ford", "Mercedes", "Ram", "Chevrolet"], i),
    model: pick(["Transit", "Sprinter", "ProMaster", "Express"], i),
    year: 2020 + (i % 5),
    licensePlate: `FS${String(1000 + i * 17).slice(-4)}`,
    assignedTo: pick(TECHS, i),
    mileage: 10_000 + i * 8_000,
    nextServiceAt: daysFromNow(30 + i * 10),
    status: i === 7 ? "maintenance" : "active",
  })));

  out["field-service.parts-request"] = seedIf("field-service.parts-request", Array.from({ length: 18 }, (_, i) => ({
    id: `fs_prq_${i + 1}`,
    code: code("PRQ", i, 5),
    jobCode: code("FS", i, 6),
    partSku: `SKU-${String(1000 + i * 7).slice(-5)}`,
    partName: pick(["Motor", "Filter", "Belt", "Seal", "Pump", "Thermostat", "Sensor"], i),
    qty: 1 + (i % 4),
    requestedBy: pick(TECHS, i),
    requestedAt: daysAgo(i * 0.5),
    status: pick(["pending", "pending", "approved", "fulfilled", "rejected"], i),
    needBy: daysFromNow((i % 7) + 1),
  })));

  out["field-service.parts-usage"] = seedIf("field-service.parts-usage", Array.from({ length: 30 }, (_, i) => ({
    id: `fs_pu_${i + 1}`,
    jobCode: code("FS", i % 40, 6),
    partSku: `SKU-${String(1000 + (i % 15) * 7).slice(-5)}`,
    partName: pick(["Motor", "Filter", "Belt", "Seal", "Pump", "Thermostat", "Sensor"], i),
    qty: 1 + (i % 3),
    unitCost: 15 + (i * 7) % 200,
    usedAt: daysAgo(i),
    technician: pick(TECHS, i),
  })));

  out["field-service.service-contract"] = seedIf("field-service.service-contract", Array.from({ length: 12 }, (_, i) => ({
    id: `fs_sc_${i + 1}`,
    code: code("FSC", i, 5),
    customer: pick(["Acme Corp", "Globex", "Initech", "Hooli", "Pied Piper"], i),
    coverage: pick(["basic", "standard", "premium", "full"], i),
    startAt: daysAgo(365 - i * 20),
    endAt: daysFromNow(365 - i * 20),
    assetsCovered: 1 + (i % 10),
    visitsPerYear: pick([2, 4, 6, 12], i),
    valueAnnual: 2_000 + ((i * 2137) % 30_000),
    status: i === 11 ? "archived" : "active",
  })));

  out["field-service.quote"] = seedIf("field-service.quote", Array.from({ length: 16 }, (_, i) => {
    const laborHours = 2 + (i % 6);
    const laborCost = laborHours * 80;
    const partsCost = 50 + (i * 23) % 500;
    const tax = Math.round((laborCost + partsCost) * 0.08);
    return {
      id: `fs_q_${i + 1}`,
      code: code("FQ", i, 5),
      customer: pick(["Acme Corp", "Globex", "Initech", "Hooli", "Pied Piper"], i),
      jobCode: code("FS", i % 40, 6),
      serviceType: pick(["install", "repair", "maintenance", "inspection"], i),
      laborHours,
      laborCost,
      partsCost,
      tax,
      total: laborCost + partsCost + tax,
      status: pick(["accepted", "accepted", "sent", "draft", "rejected", "expired"], i),
      createdAt: daysAgo(i * 3),
      validUntil: daysFromNow(30),
    };
  }));

  out["field-service.customer-site"] = seedIf("field-service.customer-site", Array.from({ length: 14 }, (_, i) => ({
    id: `fs_site_${i + 1}`,
    code: code("SITE", i, 5),
    customer: pick(["Acme Corp", "Globex", "Initech", "Hooli", "Pied Piper"], i),
    siteName: pick(["HQ", "Warehouse", "Factory 1", "Branch A", "Retail 1"], i),
    address: `${100 + i * 10} Main St`,
    city: pick(CITIES, i),
    contactName: personName(i),
    contactPhone: `+1-555-${String(4000 + i).slice(-4)}`,
    assetsCount: 2 + (i % 8),
    lastVisitAt: daysAgo(i * 10),
    nextScheduledAt: daysFromNow(30 + i * 5),
  })));

  return out;
}
