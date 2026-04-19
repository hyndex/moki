import type * as z from "zod";
import type { ResourceFieldUnderstanding, ResourceUnderstanding } from "@platform/agent-understanding";

export type ResourceFieldConfig = ResourceFieldUnderstanding & {
  searchable?: boolean;
  sortable?: boolean;
  filter?: "text" | "select" | "date" | "number";
  label: string;
};

export type ResourceAdminConfig = {
  autoCrud: boolean;
  defaultColumns: string[];
};

export type ResourcePortalConfig = {
  enabled: boolean;
};

export type ResourceAiMetadata = {
  curatedReadModel: boolean;
  purpose?: string | undefined;
  citationLabelField?: string | undefined;
  allowedFields?: string[] | undefined;
};

export type ResourceDefinition<TContract extends z.ZodTypeAny = z.ZodTypeAny> = ResourceUnderstanding & {
  id: string;
  table: unknown;
  contract: TContract;
  fields: Record<string, ResourceFieldConfig>;
  admin: ResourceAdminConfig;
  portal: ResourcePortalConfig;
  ai?: ResourceAiMetadata | undefined;
};

export function defineResource<TContract extends z.ZodTypeAny>(definition: ResourceDefinition<TContract>): ResourceDefinition<TContract> {
  return Object.freeze({
    ...definition,
    fields: Object.fromEntries(Object.entries(definition.fields).sort(([left], [right]) => left.localeCompare(right)))
  });
}

export function createResourceRegistry(resources: ResourceDefinition[]): Map<string, ResourceDefinition> {
  return new Map(resources.map((resource) => [resource.id, resource]));
}
