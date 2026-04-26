/** Minimal semver for manifest compatibility checks.
 *
 *  Supports:
 *    - Comparators: =, >, >=, <, <=
 *    - Caret: ^1.2.3 → >=1.2.3 <2.0.0
 *    - Tilde: ~1.2.3 → >=1.2.3 <1.3.0
 *    - `*` / empty → match anything
 *    - Space-separated AND: ">=1.2.0 <3.0.0"
 *    - Pipe-separated OR: "^1.0.0 || ^2.0.0"
 *
 *  Intentionally ~100 lines. For more exotic ranges (X-ranges, hyphen,
 *  prerelease rules) add a dependency on `semver`.
 */
const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9a-z.-]+))?$/i;
export function parseVersion(v) {
    const trimmed = v.trim().replace(/^v/, "");
    const m = trimmed.match(VERSION_RE);
    if (!m)
        return null;
    return {
        major: Number(m[1]),
        minor: Number(m[2]),
        patch: Number(m[3]),
        pre: m[4],
    };
}
export function compareVersions(a, b) {
    if (a.major !== b.major)
        return a.major - b.major;
    if (a.minor !== b.minor)
        return a.minor - b.minor;
    if (a.patch !== b.patch)
        return a.patch - b.patch;
    // Prereleases are considered "less than" the release version. Full SemVer
    // prerelease ordering is more nuanced; this is "good enough".
    if (!a.pre && b.pre)
        return 1;
    if (a.pre && !b.pre)
        return -1;
    if (!a.pre && !b.pre)
        return 0;
    return (a.pre ?? "").localeCompare(b.pre ?? "");
}
/** Check a single version against a single range. */
export function satisfies(version, range) {
    const v = parseVersion(version);
    if (!v)
        return false;
    const trimmed = range.trim();
    if (!trimmed || trimmed === "*" || trimmed === "x")
        return true;
    // OR-split
    const orParts = trimmed.split(/\s*\|\|\s*/);
    for (const orPart of orParts) {
        if (satisfiesAnd(v, orPart))
            return true;
    }
    return false;
}
function satisfiesAnd(v, andExpr) {
    // Expand ^ and ~ first
    const tokens = andExpr.trim().split(/\s+/).flatMap(expandShorthand);
    if (tokens.length === 0)
        return true;
    for (const token of tokens) {
        if (!satisfiesComparator(v, token))
            return false;
    }
    return true;
}
function expandShorthand(token) {
    const t = token.trim();
    if (!t)
        return [];
    if (t.startsWith("^")) {
        const base = parseVersion(t.slice(1));
        if (!base)
            return [t];
        // ^X.Y.Z → >=X.Y.Z <(X+1).0.0   (or for X=0: >=0.Y.Z <0.(Y+1).0 when Y>0 else <0.0.(Z+1))
        const upper = base.major > 0
            ? `${base.major + 1}.0.0`
            : base.minor > 0
                ? `0.${base.minor + 1}.0`
                : `0.0.${base.patch + 1}`;
        return [`>=${base.major}.${base.minor}.${base.patch}`, `<${upper}`];
    }
    if (t.startsWith("~")) {
        const base = parseVersion(t.slice(1));
        if (!base)
            return [t];
        const upper = `${base.major}.${base.minor + 1}.0`;
        return [`>=${base.major}.${base.minor}.${base.patch}`, `<${upper}`];
    }
    return [t];
}
function satisfiesComparator(v, token) {
    const match = token.match(/^(>=|<=|>|<|=)?\s*(.+)$/);
    if (!match)
        return false;
    const op = match[1] || "=";
    const target = parseVersion(match[2]);
    if (!target)
        return false;
    const cmp = compareVersions(v, target);
    switch (op) {
        case "=": return cmp === 0;
        case ">": return cmp > 0;
        case ">=": return cmp >= 0;
        case "<": return cmp < 0;
        case "<=": return cmp <= 0;
        default: return false;
    }
}
