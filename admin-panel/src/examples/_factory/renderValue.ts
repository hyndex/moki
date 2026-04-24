import * as React from "react";
import type { DomainFieldConfig } from "./buildDomainPlugin";

/** Shared value renderer used by both the list cell renderer and the
 *  rich detail page. Kept outside of buildDomainPlugin so subpackages can
 *  import it without a circular dependency. */
export function renderValue(v: unknown, f: DomainFieldConfig): React.ReactNode {
  if (v === null || v === undefined || v === "") return "—";
  if (f.kind === "boolean") return v ? "Yes" : "No";
  if (f.kind === "enum") {
    const opt = f.options?.find((o) => o.value === v);
    return opt?.label ?? String(v);
  }
  if (f.kind === "currency") return `$${Number(v).toLocaleString()}`;
  if (f.kind === "date" || f.kind === "datetime") {
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
  }
  if (f.kind === "textarea") return String(v);
  if (f.kind === "json")
    return React.createElement(
      "code",
      { className: "font-mono text-xs" },
      JSON.stringify(v, null, 2),
    );
  return String(v);
}
