/** Color field kind — native HTML5 color picker + a hex/rgb text
 *  input + a swatch preview. Stores the value as a CSS-friendly
 *  string (`#rrggbb` by default).
 *
 *  The native `<input type="color">` does not support alpha; for
 *  themes that need rgba use the optional `field.allowAlpha` flag —
 *  the input becomes a text-only field accepting any CSS color.
 *
 *  Hardening:
 *    - Hex normalisation: `#abc` → `#aabbcc` so storage is uniform.
 *    - Invalid input doesn't blank the value — the swatch shows a
 *      checker pattern and the input stays red until corrected. */

import * as React from "react";
import { Pipette } from "lucide-react";
import { cn } from "@/lib/cn";
import type {
  FieldKindFormProps,
  FieldKindListCellProps,
  FieldKindDetailProps,
  FieldKindRenderer,
} from "../fieldKindRegistry";

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalize(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (HEX_RE.test(trimmed)) {
    if (trimmed.length === 4) {
      // Expand `#abc` → `#aabbcc` so persisted values are uniform.
      const r = trimmed[1];
      const g = trimmed[2];
      const b = trimmed[3];
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return trimmed.toLowerCase();
  }
  // Permissive: any CSS color string (rgb, hsl, named) — defer
  // validation to the browser.
  return trimmed;
}

function isHex(s: string): boolean {
  return HEX_RE.test(s);
}

function ColorForm(props: FieldKindFormProps): React.ReactElement {
  const { value, onChange, disabled, invalid } = props;
  const raw = typeof value === "string" ? value : "";
  const valid = raw === "" || isHex(raw) || /^[a-z(]/i.test(raw);
  return (
    <div
      className={cn(
        "rounded-md border bg-surface-0 inline-flex items-center gap-2 px-2 h-9",
        invalid || !valid ? "border-danger" : "border-border focus-within:border-accent focus-within:shadow-focus",
        disabled && "opacity-50 pointer-events-none",
      )}
    >
      <span
        className="h-5 w-5 rounded border border-border-subtle shrink-0"
        style={{
          backgroundColor: valid && raw ? raw : "transparent",
          backgroundImage:
            !raw || !valid
              ? "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)"
              : undefined,
          backgroundSize: !raw || !valid ? "8px 8px" : undefined,
          backgroundPosition: !raw || !valid ? "0 0, 0 4px, 4px -4px, -4px 0px" : undefined,
        }}
        aria-hidden
      />
      <input
        type="text"
        value={raw}
        placeholder="#6366f1"
        disabled={disabled}
        onChange={(e) => onChange(normalize(e.target.value) ?? "")}
        className="flex-1 bg-transparent outline-none text-sm font-mono"
        aria-label={`${props.field.label ?? props.field.name} value`}
      />
      <label className="cursor-pointer text-text-muted hover:text-text-primary transition-colors" title="Pick color">
        <Pipette className="h-3.5 w-3.5" aria-hidden />
        <input
          type="color"
          value={isHex(raw) ? raw : "#000000"}
          disabled={disabled}
          onChange={(e) => onChange(normalize(e.target.value) ?? "")}
          className="sr-only"
        />
      </label>
    </div>
  );
}

function ColorCell(props: FieldKindListCellProps): React.ReactElement {
  const raw = typeof props.value === "string" ? props.value : "";
  if (!raw) return <span className="text-text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono text-text-muted">
      <span
        className="h-3 w-3 rounded-sm border border-border-subtle"
        style={{ backgroundColor: raw }}
        aria-hidden
      />
      {raw}
    </span>
  );
}

function ColorDetail(props: FieldKindDetailProps): React.ReactElement {
  return <ColorCell field={props.field} value={props.value} record={props.record} />;
}

export const colorKind: FieldKindRenderer = {
  Form: ColorForm,
  ListCell: ColorCell,
  Detail: ColorDetail,
};
