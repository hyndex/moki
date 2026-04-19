import { describe, expect, it } from "bun:test";

import { createReportExecutionRequest, createSemanticQueryDefinition, defineReport, packageId, validateReportFilterInput } from "../../src";

describe("admin-reporting", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("admin-reporting");
  });

  it("creates semantic report definitions and execution requests", () => {
    const report = defineReport({
      id: "finance.ar-aging",
      kind: "tabular",
      route: "/admin/reports/finance-ar-aging",
      label: "AR Aging",
      permission: "finance.report.ar_aging",
      query: "finance.reports.arAging",
      filters: [{ key: "asOfDate", type: "date" }],
      export: ["csv", "pdf"]
    });
    const semantic = createSemanticQueryDefinition({
      id: "finance.receivables",
      source: "finance.invoice",
      measures: ["outstandingAmount"],
      dimensions: ["customer"]
    });
    const request = createReportExecutionRequest({
      report,
      filters: { asOfDate: "2026-01-01" },
      exportFormat: "csv"
    });

    expect(semantic.measures).toEqual(["outstandingAmount"]);
    expect(request.query).toBe("finance.reports.arAging");
    expect(request.exportFormat).toBe("csv");
  });

  it("validates report filter input against approved semantic types", () => {
    expect(
      validateReportFilterInput(
        [
          { key: "asOfDate", type: "date" },
          { key: "limit", type: "number" }
        ],
        {
          asOfDate: "2026-01-01",
          limit: 20
        }
      )
    ).toEqual({
      asOfDate: "2026-01-01",
      limit: 20
    });
  });
});
