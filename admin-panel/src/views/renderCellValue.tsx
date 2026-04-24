import * as React from "react";
import { Badge } from "@/primitives/Badge";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import type { ColumnDescriptor } from "@/contracts/views";
import type { ExtensionRegistries } from "@/contracts/plugin-v2";

/** Default cell renderer used when a column doesn't supply a custom `render`.
 *
 *  Now registry-aware: if a plugin has contributed a `fieldKinds` entry with
 *  a `cell` component for the column's kind, that component takes over. This
 *  is the primary extension point for new column kinds (e.g. "color-swatch",
 *  "barcode", "rating") — plugins register once, every list view picks it up. */
export function renderCellValue(
  col: ColumnDescriptor,
  value: unknown,
  record: Record<string, unknown> = {},
  registries?: ExtensionRegistries | null,
): React.ReactNode {
  // First: registry override for the column's kind.
  if (registries && col.kind) {
    const kindSpec = registries.fieldKinds.get(col.kind);
    if (kindSpec?.cell) {
      const Cell = kindSpec.cell;
      return (
        <Cell
          value={value}
          record={record}
          options={col.options as { value: string; label: string; intent?: string }[] | undefined}
        />
      );
    }
  }

  if (value === undefined || value === null || value === "") {
    return <span className="text-text-muted">—</span>;
  }
  switch (col.kind) {
    case "boolean":
      return value ? (
        <Badge intent="success">Yes</Badge>
      ) : (
        <Badge intent="neutral">No</Badge>
      );
    case "date":
      return formatDate(value as string);
    case "datetime":
      return formatDateTime(value as string);
    case "currency":
      return formatCurrency(Number(value));
    case "number":
      return formatNumber(Number(value));
    case "enum": {
      const opt = col.options?.find((o) => o.value === value);
      if (!opt) return String(value);
      return <Badge intent={opt.intent ?? "neutral"}>{opt.label}</Badge>;
    }
    case "email":
      return (
        <a href={`mailto:${String(value)}`} className="text-text-link hover:underline">
          {String(value)}
        </a>
      );
    case "url":
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noreferrer"
          className="text-text-link hover:underline"
        >
          {String(value)}
        </a>
      );
    default:
      return String(value);
  }
}

/** Dot-path accessor: "customer.name" -> row.customer.name */
export function getPath(row: unknown, path: string): unknown {
  if (!row || typeof row !== "object") return undefined;
  const parts = path.split(".");
  let cursor: unknown = row;
  for (const p of parts) {
    if (cursor == null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[p];
  }
  return cursor;
}
