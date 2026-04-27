/** Field-kind registry — pluggable dispatch for form inputs, list-cell
 *  renderers, and detail-page viewers.
 *
 *  Why a registry: the previous architecture was a single switch in
 *  `FieldInput.tsx`, with rendering logic spread across `renderValue.ts`
 *  and ad-hoc detail pages. Adding a new kind (image, geo, video) meant
 *  forking three files. The registry centralises this:
 *
 *      const renderer = getFieldKindRenderer(field.kind);
 *      // → { Form?, ListCell?, Detail? } | undefined
 *
 *  Built-in kinds (text, number, date, …) keep their existing path —
 *  the registry is consulted FIRST and the legacy switch is the
 *  fallback. New kinds register through `registerFieldKind()` and the
 *  switch never sees them.
 *
 *  Each renderer is three optional components. Pages render only what
 *  they need:
 *
 *    - Form    : input shown inside `<FormView>`. Receives value +
 *                onChange + the full field descriptor + record context.
 *    - ListCell: compact cell shown inside `<ListView>` rows. No
 *                onChange — read-only display.
 *    - Detail  : large viewer shown on detail / hub pages. May be
 *                interactive (lightbox, map, video player). */

import * as React from "react";
import type { FieldDescriptor, FieldKind } from "@/contracts/fields";

export interface FieldKindContext {
  /** The full descriptor (label, options, kind, required, …). */
  field: FieldDescriptor;
  /** Surrounding record — picker components need it to filter
   *  reference candidates by another field's value. */
  record?: Record<string, unknown>;
}

export interface FieldKindFormProps extends FieldKindContext {
  value: unknown;
  onChange: (next: unknown) => void;
  invalid?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /** Stable form-id for the underlying input — used by external
   *  `<label htmlFor>` mounts. */
  inputId?: string;
}

export interface FieldKindListCellProps extends FieldKindContext {
  value: unknown;
}

export interface FieldKindDetailProps extends FieldKindContext {
  value: unknown;
}

export interface FieldKindRenderer {
  /** Form input — used by `<FieldInput>`. */
  Form?: React.ComponentType<FieldKindFormProps>;
  /** Compact list cell — used by `<ListView>`'s value renderer. */
  ListCell?: React.ComponentType<FieldKindListCellProps>;
  /** Detail viewer — used by detail / hub pages. */
  Detail?: React.ComponentType<FieldKindDetailProps>;
  /** When true, the registry's renderer takes precedence even over
   *  `field.render` callbacks. Default: false (so a per-field override
   *  always wins over the global registry). */
  override?: boolean;
}

const REGISTRY = new Map<string, FieldKindRenderer>();

/** Register a renderer for a kind. Calling twice REPLACES the previous
 *  registration — plugins shipping their own renderer for an existing
 *  kind can swap the default by registering after the first activate
 *  hook runs. */
export function registerFieldKind(kind: FieldKind | string, renderer: FieldKindRenderer): void {
  REGISTRY.set(kind, renderer);
}

/** Look up the registered renderer for a kind. Returns undefined when
 *  no renderer is registered (caller should fall back to legacy
 *  switch / default text input). */
export function getFieldKindRenderer(kind: FieldKind | string): FieldKindRenderer | undefined {
  return REGISTRY.get(kind);
}

/** Test-only: clear the registry. Never used in production code. */
export function _resetFieldKindRegistry_forTest(): void {
  REGISTRY.clear();
}

/** List every registered kind — used by the demo page + by the
 *  Archetypes Catalog at /settings/archetypes. */
export function registeredFieldKinds(): readonly string[] {
  return Array.from(REGISTRY.keys());
}
