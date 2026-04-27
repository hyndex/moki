import * as React from "react";
import type { DomainFieldConfig } from "./buildDomainPlugin";
import { getFieldKindRenderer } from "@/views/fieldKindRegistry";
import "@/views/field-kinds/registerAll";

/** Shared value renderer used by both the list cell renderer and the
 *  rich detail page. Kept outside of buildDomainPlugin so subpackages can
 *  import it without a circular dependency.
 *
 *  The field-kind registry is consulted FIRST — advanced kinds (image,
 *  geo, video, …) ship as registered ListCell components. Built-in
 *  primitives (text, number, date, …) flow through the legacy switch
 *  below, byte-identical to the previous behaviour. */
export function renderValue(v: unknown, f: DomainFieldConfig): React.ReactNode {
  if (v === null || v === undefined || v === "") return "—";

  const reg = getFieldKindRenderer(f.kind);
  if (reg?.ListCell) {
    return React.createElement(reg.ListCell, {
      field: f as DomainFieldConfig,
      value: v,
    });
  }

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
