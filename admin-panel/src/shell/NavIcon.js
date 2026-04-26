import { jsx as _jsx } from "react/jsx-runtime";
import * as Icons from "lucide-react";
/** Resolve a lucide icon by name (string) — falls back to Box. */
export function NavIcon({ name, className, }) {
    if (!name)
        return null;
    const registry = Icons;
    const Cmp = registry[toPascal(name)] ?? Icons.Box;
    return _jsx(Cmp, { className: className });
}
function toPascal(s) {
    return s
        .split(/[-_\s]/)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join("");
}
