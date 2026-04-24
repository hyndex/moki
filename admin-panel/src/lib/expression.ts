/** Safe arithmetic expression evaluator for calculated columns.
 *
 *  Supports:
 *    - Numeric literals (42, 3.14, -1.5)
 *    - String literals ('foo', "bar")
 *    - Field references (snake_case, camelCase, dotted paths: revenue, customer.name, line_items.0.price)
 *    - Parentheses
 *    - Binary operators: + - * /  %  ==  !=  <  <=  >  >=  && ||
 *    - Unary: - !
 *    - Ternary: cond ? a : b
 *    - Function calls from a small allowlist: abs, min, max, round, floor, ceil,
 *      sum, avg, len, coalesce, date_diff (days), upper, lower
 *    - Null-safe: missing field → null; null + null → null (treated as 0 in arithmetic)
 *
 *  Explicitly NO access to globals, no member calls on arbitrary objects,
 *  no `new`, no regex — it's a calculator + field reader, nothing more.
 *
 *  ERPNext's Formula Field does roughly the same thing, slightly more
 *  opinionated. This is the safer superset for our admin-panel use case.
 */

import { getPath } from "./filterEngine";

export interface EvalResult {
  value: unknown;
  error?: string;
}

const CACHE = new Map<string, AstNode | string>();

export function evalExpression(
  expr: string,
  record: Record<string, unknown>,
): EvalResult {
  if (!expr) return { value: undefined };
  let ast = CACHE.get(expr);
  if (!ast) {
    try {
      ast = parse(expr);
    } catch (err) {
      ast = (err as Error).message;
    }
    CACHE.set(expr, ast);
  }
  if (typeof ast === "string") return { value: undefined, error: ast };
  try {
    const v = run(ast, record);
    return { value: v };
  } catch (err) {
    return { value: undefined, error: (err as Error).message };
  }
}

/** Given a record and an expression, return the typed value (numeric default 0). */
export function evalExpressionNumeric(
  expr: string,
  record: Record<string, unknown>,
): number {
  const r = evalExpression(expr, record);
  if (typeof r.value === "number" && Number.isFinite(r.value)) return r.value;
  const n = Number(r.value);
  return Number.isFinite(n) ? n : 0;
}

/* ================= Tokenizer ================= */

type Token =
  | { kind: "num"; value: number }
  | { kind: "str"; value: string }
  | { kind: "id"; value: string }
  | { kind: "punct"; value: string };

const PUNCT = [
  "==",
  "!=",
  "<=",
  ">=",
  "&&",
  "||",
  "(",
  ")",
  ",",
  "+",
  "-",
  "*",
  "/",
  "%",
  "<",
  ">",
  "?",
  ":",
  "!",
  ".",
];

function tokenize(expr: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    // Numeric literal
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < expr.length && /[0-9.]/.test(expr[j])) j++;
      out.push({ kind: "num", value: Number(expr.slice(i, j)) });
      i = j;
      continue;
    }
    // String literal
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < expr.length && expr[j] !== c) j++;
      if (j >= expr.length) throw new Error("unterminated string");
      out.push({ kind: "str", value: expr.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    // Identifier / keyword — letters, digits, _ and . (for field paths)
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < expr.length && /[A-Za-z0-9_.]/.test(expr[j])) j++;
      out.push({ kind: "id", value: expr.slice(i, j) });
      i = j;
      continue;
    }
    // Multi-char punct
    const two = expr.slice(i, i + 2);
    if (PUNCT.includes(two)) {
      out.push({ kind: "punct", value: two });
      i += 2;
      continue;
    }
    // Single-char punct
    if (PUNCT.includes(c)) {
      out.push({ kind: "punct", value: c });
      i++;
      continue;
    }
    throw new Error(`unexpected character '${c}' at ${i}`);
  }
  return out;
}

/* ================= Parser (Pratt) ================= */

type AstNode =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "id"; v: string }
  | { t: "unary"; op: string; a: AstNode }
  | { t: "bin"; op: string; a: AstNode; b: AstNode }
  | { t: "ternary"; c: AstNode; a: AstNode; b: AstNode }
  | { t: "call"; name: string; args: AstNode[] };

const PREC: Record<string, number> = {
  "||": 1,
  "&&": 2,
  "==": 3,
  "!=": 3,
  "<": 4,
  "<=": 4,
  ">": 4,
  ">=": 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
  "%": 6,
};

function parse(expr: string): AstNode {
  const toks = tokenize(expr);
  let p = 0;

  const peek = () => toks[p];
  const eat = (v?: string) => {
    const t = toks[p++];
    if (v && !(t && t.kind === "punct" && t.value === v))
      throw new Error(`expected '${v}'`);
    return t;
  };

  function parseExpr(minPrec = 0): AstNode {
    let left = parseUnary();
    while (true) {
      const t = peek();
      if (!t || t.kind !== "punct") break;
      if (t.value === "?") {
        p++;
        const a = parseExpr(0);
        eat(":");
        const b = parseExpr(0);
        left = { t: "ternary", c: left, a, b };
        continue;
      }
      const prec = PREC[t.value];
      if (prec === undefined || prec < minPrec) break;
      p++;
      const right = parseExpr(prec + 1);
      left = { t: "bin", op: t.value, a: left, b: right };
    }
    return left;
  }

  function parseUnary(): AstNode {
    const t = peek();
    if (t && t.kind === "punct" && (t.value === "-" || t.value === "!")) {
      p++;
      return { t: "unary", op: t.value, a: parseUnary() };
    }
    return parsePrimary();
  }

  function parsePrimary(): AstNode {
    const t = toks[p++];
    if (!t) throw new Error("unexpected end");
    if (t.kind === "num") return { t: "num", v: t.value };
    if (t.kind === "str") return { t: "str", v: t.value };
    if (t.kind === "id") {
      const next = peek();
      if (next && next.kind === "punct" && next.value === "(") {
        p++;
        const args: AstNode[] = [];
        if (peek()?.value !== ")") {
          args.push(parseExpr(0));
          while (peek()?.value === ",") {
            p++;
            args.push(parseExpr(0));
          }
        }
        eat(")");
        return { t: "call", name: t.value, args };
      }
      return { t: "id", v: t.value };
    }
    if (t.kind === "punct" && t.value === "(") {
      const inner = parseExpr(0);
      eat(")");
      return inner;
    }
    throw new Error(`unexpected token ${JSON.stringify(t)}`);
  }

  const ast = parseExpr(0);
  if (p < toks.length) throw new Error("trailing tokens");
  return ast;
}

/* ================= Runtime ================= */

const FUNCS: Record<string, (...args: unknown[]) => unknown> = {
  abs: (x) => Math.abs(toNum(x)),
  min: (...xs) => Math.min(...xs.map(toNum)),
  max: (...xs) => Math.max(...xs.map(toNum)),
  round: (x, places) =>
    Number(Math.round(toNum(x) * 10 ** toNum(places ?? 0)) / 10 ** toNum(places ?? 0)),
  floor: (x) => Math.floor(toNum(x)),
  ceil: (x) => Math.ceil(toNum(x)),
  sum: (...xs) => xs.reduce<number>((a, b) => a + toNum(b), 0),
  avg: (...xs) => (xs.length ? xs.reduce<number>((a, b) => a + toNum(b), 0) / xs.length : 0),
  len: (x) => {
    if (Array.isArray(x)) return x.length;
    if (typeof x === "string") return x.length;
    return 0;
  },
  coalesce: (...xs) => xs.find((x) => x !== null && x !== undefined) ?? null,
  date_diff: (a, b) => {
    const ta = toTime(a);
    const tb = toTime(b);
    if (ta === null || tb === null) return null;
    return Math.round((ta - tb) / 86_400_000);
  },
  upper: (x) => String(x ?? "").toUpperCase(),
  lower: (x) => String(x ?? "").toLowerCase(),
};

function run(node: AstNode, rec: Record<string, unknown>): unknown {
  switch (node.t) {
    case "num":
      return node.v;
    case "str":
      return node.v;
    case "id": {
      // Keywords
      if (node.v === "true") return true;
      if (node.v === "false") return false;
      if (node.v === "null") return null;
      return getPath(rec, node.v) ?? null;
    }
    case "unary": {
      const a = run(node.a, rec);
      if (node.op === "-") return -toNum(a);
      if (node.op === "!") return !toBool(a);
      throw new Error("bad unary");
    }
    case "bin": {
      const a = run(node.a, rec);
      // Short-circuit logical
      if (node.op === "&&") return toBool(a) ? run(node.b, rec) : a;
      if (node.op === "||") return toBool(a) ? a : run(node.b, rec);
      const b = run(node.b, rec);
      switch (node.op) {
        case "+":
          // String concat if either is string
          if (typeof a === "string" || typeof b === "string")
            return String(a ?? "") + String(b ?? "");
          return toNum(a) + toNum(b);
        case "-":
          return toNum(a) - toNum(b);
        case "*":
          return toNum(a) * toNum(b);
        case "/": {
          const d = toNum(b);
          return d === 0 ? null : toNum(a) / d;
        }
        case "%":
          return toNum(a) % toNum(b);
        case "==":
          return a == b; // eslint-disable-line eqeqeq
        case "!=":
          return a != b; // eslint-disable-line eqeqeq
        case "<":
          return toNum(a) < toNum(b);
        case "<=":
          return toNum(a) <= toNum(b);
        case ">":
          return toNum(a) > toNum(b);
        case ">=":
          return toNum(a) >= toNum(b);
        default:
          throw new Error("bad binop " + node.op);
      }
    }
    case "ternary":
      return toBool(run(node.c, rec))
        ? run(node.a, rec)
        : run(node.b, rec);
    case "call": {
      const fn = FUNCS[node.name];
      if (!fn) throw new Error("unknown function " + node.name);
      return fn(...node.args.map((a) => run(a, rec)));
    }
  }
}

function toNum(x: unknown): number {
  if (x === null || x === undefined || x === "") return 0;
  if (typeof x === "number") return x;
  if (typeof x === "boolean") return x ? 1 : 0;
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}
function toBool(x: unknown): boolean {
  if (x === null || x === undefined || x === "" || x === 0 || x === false)
    return false;
  return Boolean(x);
}
function toTime(x: unknown): number | null {
  if (x === null || x === undefined || x === "") return null;
  if (typeof x === "number") return x;
  const t = Date.parse(String(x));
  return Number.isFinite(t) ? t : null;
}
