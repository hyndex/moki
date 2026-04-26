/** Client-side filter tree evaluator.
 *
 *  ERPNext parity — supports every operator declared in FilterOp. For
 *  relative-date operators the "now" reference is the machine clock at
 *  evaluation time; pass `now` to override (for tests / server consistency).
 *
 *  Dot paths are supported for `field`: `customer.name`, `address.city`.
 *
 *  Null semantics: a missing field → `null`; `eq`/`neq` against null treats
 *  `undefined` and `null` as equivalent. `is_empty` is true for null / ""
 *  / empty array; `is_null` is true only for null or undefined.
 */
export function evalFilter(record, tree, now = new Date()) {
    if ("and" in tree) {
        if (tree.and.length === 0)
            return true;
        return tree.and.every((c) => evalFilter(record, c, now));
    }
    if ("or" in tree) {
        if (tree.or.length === 0)
            return true;
        return tree.or.some((c) => evalFilter(record, c, now));
    }
    return evalLeaf(record, tree, now);
}
export function filterRows(rows, tree, now = new Date()) {
    if (!tree)
        return [...rows];
    return rows.filter((r) => evalFilter(r, tree, now));
}
/* ---------------- leaf evaluation ---------------- */
function evalLeaf(record, leaf, now) {
    const raw = getPath(record, leaf.field);
    const op = leaf.op;
    switch (op) {
        case "is_null":
            return raw === null || raw === undefined;
        case "is_not_null":
            return !(raw === null || raw === undefined);
        case "is_empty":
            return (raw === null ||
                raw === undefined ||
                raw === "" ||
                (Array.isArray(raw) && raw.length === 0));
        case "is_not_empty":
            return !(raw === null ||
                raw === undefined ||
                raw === "" ||
                (Array.isArray(raw) && raw.length === 0));
    }
    // Relative date ops
    const rel = relativeRange(op, now);
    if (rel) {
        const t = toTime(raw);
        if (t === null)
            return false;
        return t >= rel[0] && t < rel[1];
    }
    // last_n_days
    if (op === "last_n_days") {
        const days = Number(leaf.value) || 0;
        if (days <= 0)
            return false;
        const t = toTime(raw);
        if (t === null)
            return false;
        const end = now.getTime();
        const start = end - days * 86_400_000;
        return t >= start && t < end;
    }
    // Value operators
    const v = leaf.value;
    switch (op) {
        case "eq":
            return eq(raw, v);
        case "neq":
            return !eq(raw, v);
        case "lt":
            return cmp(raw, v) < 0;
        case "lte":
            return cmp(raw, v) <= 0;
        case "gt":
            return cmp(raw, v) > 0;
        case "gte":
            return cmp(raw, v) >= 0;
        case "in":
            return Array.isArray(v) && v.some((x) => eq(raw, x));
        case "nin":
            return Array.isArray(v) && !v.some((x) => eq(raw, x));
        case "contains":
            return String(raw ?? "")
                .toLowerCase()
                .includes(String(v ?? "").toLowerCase());
        case "not_contains":
            return !String(raw ?? "")
                .toLowerCase()
                .includes(String(v ?? "").toLowerCase());
        case "starts_with":
            return String(raw ?? "")
                .toLowerCase()
                .startsWith(String(v ?? "").toLowerCase());
        case "ends_with":
            return String(raw ?? "")
                .toLowerCase()
                .endsWith(String(v ?? "").toLowerCase());
        case "between": {
            if (!Array.isArray(v) || v.length !== 2)
                return false;
            return cmp(raw, v[0]) >= 0 && cmp(raw, v[1]) <= 0;
        }
        default:
            return true;
    }
}
/* ---------------- helpers ---------------- */
export function getPath(obj, path) {
    if (!obj)
        return undefined;
    if (!path.includes("."))
        return obj[path];
    let cur = obj;
    for (const seg of path.split(".")) {
        if (cur === null || cur === undefined)
            return undefined;
        cur = cur[seg];
    }
    return cur;
}
function eq(a, b) {
    if (a === b)
        return true;
    if ((a === null || a === undefined) && (b === null || b === undefined))
        return true;
    if (typeof a === "number" && typeof b === "string")
        return a === Number(b);
    if (typeof a === "string" && typeof b === "number")
        return Number(a) === b;
    return false;
}
function cmp(a, b) {
    if (a === b)
        return 0;
    if (a === null || a === undefined)
        return -1;
    if (b === null || b === undefined)
        return 1;
    if (typeof a === "number" && typeof b === "number")
        return a - b;
    // date strings
    if (typeof a === "string" && typeof b === "string") {
        const ta = Date.parse(a);
        const tb = Date.parse(b);
        if (!Number.isNaN(ta) && !Number.isNaN(tb))
            return ta - tb;
        return a.localeCompare(b);
    }
    return String(a).localeCompare(String(b));
}
function toTime(v) {
    if (v === null || v === undefined || v === "")
        return null;
    if (typeof v === "number")
        return v;
    const t = Date.parse(String(v));
    return Number.isNaN(t) ? null : t;
}
/** Returns [startMs, endMs) half-open range for relative date ops, or null. */
function relativeRange(op, now) {
    const day = 86_400_000;
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    const todayStart = new Date(y, m, d).getTime();
    const todayEnd = todayStart + day;
    switch (op) {
        case "today":
            return [todayStart, todayEnd];
        case "yesterday":
            return [todayStart - day, todayStart];
        case "this_week": {
            const day0 = (now.getDay() + 6) % 7; // Monday = 0
            const weekStart = todayStart - day0 * day;
            return [weekStart, weekStart + 7 * day];
        }
        case "last_week": {
            const day0 = (now.getDay() + 6) % 7;
            const weekStart = todayStart - day0 * day;
            return [weekStart - 7 * day, weekStart];
        }
        case "this_month":
        case "mtd": {
            const start = new Date(y, m, 1).getTime();
            const end = op === "mtd" ? todayEnd : new Date(y, m + 1, 1).getTime();
            return [start, end];
        }
        case "last_month": {
            const start = new Date(y, m - 1, 1).getTime();
            const end = new Date(y, m, 1).getTime();
            return [start, end];
        }
        case "this_quarter":
        case "qtd": {
            const qStart = m - (m % 3);
            const start = new Date(y, qStart, 1).getTime();
            const end = op === "qtd" ? todayEnd : new Date(y, qStart + 3, 1).getTime();
            return [start, end];
        }
        case "last_quarter": {
            const qStart = m - (m % 3) - 3;
            const start = new Date(y, qStart, 1).getTime();
            const end = new Date(y, qStart + 3, 1).getTime();
            return [start, end];
        }
        case "this_year":
        case "ytd": {
            const start = new Date(y, 0, 1).getTime();
            const end = op === "ytd" ? todayEnd : new Date(y + 1, 0, 1).getTime();
            return [start, end];
        }
        case "last_year": {
            const start = new Date(y - 1, 0, 1).getTime();
            const end = new Date(y, 0, 1).getTime();
            return [start, end];
        }
        default:
            return null;
    }
}
/* ---------------- Human-readable label ---------------- */
export function describeFilter(tree) {
    if (!tree)
        return "No filter";
    if ("and" in tree)
        return tree.and.map(describeFilter).join(" AND ");
    if ("or" in tree)
        return tree.or.map(describeFilter).join(" OR ");
    const { field, op, value } = tree;
    const valStr = Array.isArray(value) ? value.join(", ") : String(value ?? "");
    return `${field} ${op}${valStr ? " " + valStr : ""}`;
}
export const OPERATORS = [
    // compare
    { op: "eq", label: "equals", arity: 1, group: "compare", supports: ["text", "number", "currency", "boolean", "date", "datetime", "enum", "reference"] },
    { op: "neq", label: "does not equal", arity: 1, group: "compare", supports: ["text", "number", "currency", "boolean", "date", "datetime", "enum", "reference"] },
    { op: "lt", label: "less than", arity: 1, group: "compare", supports: ["number", "currency", "date", "datetime"] },
    { op: "lte", label: "less than or equal", arity: 1, group: "compare", supports: ["number", "currency", "date", "datetime"] },
    { op: "gt", label: "greater than", arity: 1, group: "compare", supports: ["number", "currency", "date", "datetime"] },
    { op: "gte", label: "greater than or equal", arity: 1, group: "compare", supports: ["number", "currency", "date", "datetime"] },
    // text
    { op: "contains", label: "contains", arity: 1, group: "text", supports: ["text"] },
    { op: "not_contains", label: "does not contain", arity: 1, group: "text", supports: ["text"] },
    { op: "starts_with", label: "starts with", arity: 1, group: "text", supports: ["text"] },
    { op: "ends_with", label: "ends with", arity: 1, group: "text", supports: ["text"] },
    // set
    { op: "in", label: "is one of", arity: 1, group: "set", supports: ["text", "number", "enum", "reference", "multi-enum"] },
    { op: "nin", label: "is not one of", arity: 1, group: "set", supports: ["text", "number", "enum", "reference", "multi-enum"] },
    // range
    { op: "between", label: "between", arity: 2, group: "range", supports: ["number", "currency", "date", "datetime"] },
    // relative dates
    { op: "today", label: "today", arity: 0, group: "date", supports: ["date", "datetime"] },
    { op: "yesterday", label: "yesterday", arity: 0, group: "date", supports: ["date", "datetime"] },
    { op: "this_week", label: "this week", arity: 0, group: "date", supports: ["date", "datetime"] },
    { op: "last_week", label: "last week", arity: 0, group: "date", supports: ["date", "datetime"] },
    { op: "this_month", label: "this month", arity: 0, group: "date", supports: ["date", "datetime"] },
    { op: "last_month", label: "last month", arity: 0, group: "date", supports: ["date", "datetime"] },
    { op: "mtd", label: "month-to-date", arity: 0, group: "date", supports: ["date", "datetime"] },
    { op: "this_quarter", label: "this quarter", arity: 0, group: "date", supports: ["date", "datetime"] },
    { op: "qtd", label: "quarter-to-date", arity: 0, group: "date", supports: ["date", "datetime"] },
    { op: "this_year", label: "this year", arity: 0, group: "date", supports: ["date", "datetime"] },
    { op: "ytd", label: "year-to-date", arity: 0, group: "date", supports: ["date", "datetime"] },
    { op: "last_n_days", label: "in the last N days", arity: 1, group: "date", supports: ["date", "datetime"] },
    // null
    { op: "is_empty", label: "is empty", arity: 0, group: "null", supports: ["text", "number", "currency", "date", "datetime", "enum", "multi-enum", "reference"] },
    { op: "is_not_empty", label: "is not empty", arity: 0, group: "null", supports: ["text", "number", "currency", "date", "datetime", "enum", "multi-enum", "reference"] },
    { op: "is_null", label: "is null", arity: 0, group: "null", supports: ["text", "number", "currency", "date", "datetime", "enum", "multi-enum", "reference"] },
    { op: "is_not_null", label: "is not null", arity: 0, group: "null", supports: ["text", "number", "currency", "date", "datetime", "enum", "multi-enum", "reference"] },
];
export function operatorsFor(kind) {
    return OPERATORS.filter((o) => o.supports.includes(kind));
}
