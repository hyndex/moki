import type { ZodTypeAny, z } from "zod";
import type { ErpResourceMetadata } from "./erp-metadata";

/** A resource = a typed collection a plugin owns (e.g. "booking", "contact"). */
export interface ResourceDefinition<TSchema extends ZodTypeAny = ZodTypeAny> {
  /** Fully-qualified id — conventionally `<plugin>.<resource>`. */
  readonly id: string;
  /** Human label singular (used in detail headers, "New …" buttons). */
  readonly singular: string;
  /** Human label plural (used in nav + list headers). */
  readonly plural: string;
  /** Zod schema — the source of truth for validation + inference. */
  readonly schema: TSchema;
  /** Field selector that identifies the row (default: "id"). */
  readonly primaryKey?: string;
  /** Field used for human display in pickers / references. */
  readonly displayField?: string;
  /** Optional search-indexable fields. If omitted, command palette skips. */
  readonly searchable?: readonly string[];
  /** Optional icon token name (lucide icon). */
  readonly icon?: string;
  /** Optional ERP-grade metadata used by builders, workspaces, print, portal, and document mapping. */
  readonly erp?: ErpResourceMetadata;
}

export type ResourceRecord<R extends ResourceDefinition> = z.infer<R["schema"]>;

export type ResourceId<R extends ResourceDefinition> =
  ResourceRecord<R> extends { id: infer I } ? I & (string | number) : string;
