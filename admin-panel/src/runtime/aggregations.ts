import type {
  AggregationResult,
  AggregationSpec,
  TimePeriod,
  TimeRange,
} from "@/contracts/widgets";
import type { FilterLeaf, FilterTree } from "@/contracts/saved-views";
import { ResourceClient } from "./resourceClient";

function evalLeaf(leaf: FilterLeaf, record: Record<string, unknown>): boolean {
  const v = record[leaf.field];
  switch (leaf.op) {
    case "eq": return v === leaf.value;
    case "neq": return v !== leaf.value;
    case "lt": return typeof v === "number" && typeof leaf.value === "number" && v < leaf.value;
    case "lte": return typeof v === "number" && typeof leaf.value === "number" && v <= leaf.value;
    case "gt": return typeof v === "number" && typeof leaf.value === "number" && v > leaf.value;
    case "gte": return typeof v === "number" && typeof leaf.value === "number" && v >= leaf.value;
    case "in": return Array.isArray(leaf.value) && (leaf.value as unknown[]).includes(v);
    case "nin": return Array.isArray(leaf.value) && !(leaf.value as unknown[]).includes(v);
    case "contains": return typeof v === "string" && typeof leaf.value === "string" && v.toLowerCase().includes(leaf.value.toLowerCase());
    case "starts_with": return typeof v === "string" && typeof leaf.value === "string" && v.toLowerCase().startsWith(leaf.value.toLowerCase());
    case "is_null": return v === null || v === undefined;
    case "is_not_null": return v !== null && v !== undefined;
    case "between": {
      if (!Array.isArray(leaf.value) || leaf.value.length !== 2) return false;
      if (typeof v === "number") return v >= (leaf.value[0] as number) && v <= (leaf.value[1] as number);
      if (typeof v === "string") return v >= (leaf.value[0] as string) && v <= (leaf.value[1] as string);
      return false;
    }
    default: return false;
  }
}

export function evalFilter(tree: FilterTree, record: Record<string, unknown>): boolean {
  if ("and" in tree) return tree.and.every((c) => evalFilter(c, record));
  if ("or" in tree) return tree.or.some((c) => evalFilter(c, record));
  return evalLeaf(tree as FilterLeaf, record);
}

export function resolveTimeRange(range: TimeRange | undefined): { from: Date | null; to: Date | null } {
  const now = new Date();
  if (!range || range.kind === "all") return { from: null, to: null };
  if (range.kind === "between") return { from: new Date(range.from), to: new Date(range.to) };
  if (range.kind === "last") {
    const from = new Date(now);
    from.setDate(from.getDate() - range.days);
    return { from, to: now };
  }
  if (range.kind === "mtd") return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  if (range.kind === "qtd") {
    const q = Math.floor(now.getMonth() / 3);
    return { from: new Date(now.getFullYear(), q * 3, 1), to: now };
  }
  if (range.kind === "ytd") return { from: new Date(now.getFullYear(), 0, 1), to: now };
  return { from: null, to: null };
}

function bucketKey(d: Date, period: TimePeriod): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  switch (period) {
    case "day": return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    case "week": {
      const onejan = new Date(y, 0, 1);
      const wk = Math.ceil(((d.getTime() - onejan.getTime()) / 86_400_000 + onejan.getDay() + 1) / 7);
      return `${y}-W${String(wk).padStart(2, "0")}`;
    }
    case "month": return `${y}-${String(m).padStart(2, "0")}`;
    case "quarter": return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
    case "year": return `${y}`;
  }
}

function aggregate(
  records: readonly Record<string, unknown>[],
  fn: AggregationSpec["fn"],
  field?: string,
): number {
  if (fn === "count") return records.length;
  if (!field) return 0;
  const values = records
    .map((r) => r[field])
    .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  if (values.length === 0) return 0;
  switch (fn) {
    case "sum": return values.reduce((a, b) => a + b, 0);
    case "avg": return values.reduce((a, b) => a + b, 0) / values.length;
    case "min": return Math.min(...values);
    case "max": return Math.max(...values);
    default: return 0;
  }
}

function previousRange(range: TimeRange | undefined): TimeRange | undefined {
  if (!range) return undefined;
  const now = new Date();
  if (range.kind === "last") {
    const to = new Date(now);
    to.setDate(to.getDate() - range.days);
    const from = new Date(to);
    from.setDate(from.getDate() - range.days);
    return { kind: "between", from: from.toISOString(), to: to.toISOString() };
  }
  if (range.kind === "mtd") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { kind: "between", from: start.toISOString(), to: end.toISOString() };
  }
  if (range.kind === "qtd") {
    const q = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), (q - 1) * 3, 1);
    const end = new Date(now.getFullYear(), q * 3, 0, 23, 59, 59);
    return { kind: "between", from: start.toISOString(), to: end.toISOString() };
  }
  if (range.kind === "ytd") {
    const start = new Date(now.getFullYear() - 1, 0, 1);
    const end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
    return { kind: "between", from: start.toISOString(), to: end.toISOString() };
  }
  return undefined;
}

export async function computeAggregation(
  spec: AggregationSpec,
  resources: ResourceClient,
): Promise<AggregationResult> {
  const dateField = spec.dateField ?? "createdAt";
  const list = await resources.list(spec.resource, {
    page: 1,
    pageSize: 5000,
  });
  const all = list.rows as Record<string, unknown>[];

  const inRange = (records: Record<string, unknown>[], range: TimeRange | undefined) => {
    const { from, to } = resolveTimeRange(range);
    if (!from && !to) return records;
    return records.filter((r) => {
      const raw = r[dateField];
      if (typeof raw !== "string" && !(raw instanceof Date)) return true;
      const t = new Date(raw as string | Date).getTime();
      if (Number.isNaN(t)) return true;
      if (from && t < from.getTime()) return false;
      if (to && t > to.getTime()) return false;
      return true;
    });
  };

  const filtered = spec.filter
    ? all.filter((r) => evalFilter(spec.filter!, r))
    : all;

  const current = inRange(filtered, spec.range);
  const value = aggregate(current, spec.fn, spec.field);

  let previousValue: number | undefined;
  const prevRange = previousRange(spec.range);
  if (prevRange) {
    const previous = inRange(filtered, prevRange);
    previousValue = aggregate(previous, spec.fn, spec.field);
  }

  let series: AggregationResult["series"];
  if (spec.period) {
    const buckets = new Map<string, Record<string, unknown>[]>();
    for (const r of current) {
      const raw = r[dateField];
      if (typeof raw !== "string" && !(raw instanceof Date)) continue;
      const d = new Date(raw as string | Date);
      if (Number.isNaN(d.getTime())) continue;
      const key = bucketKey(d, spec.period);
      const list = buckets.get(key) ?? [];
      list.push(r);
      buckets.set(key, list);
    }
    series = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, rs]) => ({ label, value: aggregate(rs, spec.fn, spec.field) }));
  }

  let groups: AggregationResult["groups"];
  if (spec.groupBy) {
    const map = new Map<string, Record<string, unknown>[]>();
    for (const r of current) {
      const key = String(r[spec.groupBy] ?? "—");
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    groups = [...map.entries()]
      .map(([label, rs]) => ({ label, value: aggregate(rs, spec.fn, spec.field) }))
      .sort((a, b) => b.value - a.value);
  }

  return {
    value,
    previousValue,
    series,
    groups,
    count: current.length,
    asOf: new Date().toISOString(),
  };
}
