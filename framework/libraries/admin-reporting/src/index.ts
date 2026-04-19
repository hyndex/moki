import type { ReportContribution, ReportFilterDefinition } from "@platform/admin-contracts";
import { defineReport } from "@platform/admin-contracts";
import { z } from "zod";

export const packageId = "admin-reporting" as const;
export const packageDisplayName = "Admin Reporting" as const;
export const packageDescription = "Report contracts, filter validation, and semantic execution requests." as const;

export type SemanticQueryDefinition = {
  id: string;
  source: string;
  measures: string[];
  dimensions: string[];
};

export type ReportExecutionRequest = {
  reportId: string;
  query: string;
  filters: Record<string, string | number | boolean>;
  exportFormat?: ReportContribution["export"][number] | undefined;
};

export function createSemanticQueryDefinition(definition: SemanticQueryDefinition): SemanticQueryDefinition {
  return Object.freeze({
    ...definition,
    measures: [...definition.measures].sort((left, right) => left.localeCompare(right)),
    dimensions: [...definition.dimensions].sort((left, right) => left.localeCompare(right))
  });
}

export function createReportExecutionRequest(input: {
  report: ReportContribution;
  filters?: Record<string, string | number | boolean | undefined> | undefined;
  exportFormat?: ReportContribution["export"][number] | undefined;
}): ReportExecutionRequest {
  return {
    reportId: input.report.id,
    query: input.report.query,
    filters: Object.fromEntries(
      Object.entries(input.filters ?? {}).filter(([, value]) => value !== undefined)
    ) as Record<string, string | number | boolean>,
    exportFormat: input.exportFormat
  };
}

export function validateReportFilterInput(
  filters: ReportFilterDefinition[],
  values: Record<string, unknown>
): Record<string, string | number | boolean> {
  const output: Record<string, string | number | boolean> = {};

  for (const filter of filters) {
    const value = values[filter.key];
    if (value === undefined || value === null) {
      continue;
    }

    const schema =
      filter.type === "number"
        ? z.number()
        : filter.type === "select"
          ? z.string().min(1)
          : filter.type === "date" || filter.type === "date-range"
            ? z.string().min(1)
            : z.union([z.string(), z.boolean()]);

    output[filter.key] = schema.parse(value);
  }

  return output;
}

export { defineReport };
