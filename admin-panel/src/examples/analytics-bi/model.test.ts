import { describe, expect, test } from "bun:test";
import type { AnalyticsExplore, MetricQuery } from "./api";
import {
  defaultQuery,
  explorePathForQuery,
  matchesSearch,
  queryFromHash,
  serializeQueryState,
  toggleDimension,
  toggleMetric,
} from "./model";

const explore: AnalyticsExplore = {
  id: "sales-deals",
  label: "Sales deals",
  resource: "sales.deal",
  dimensions: [
    { id: "stage", label: "Stage", type: "string", sourceField: "stage" },
    { id: "owner", label: "Owner", type: "string", sourceField: "owner" },
  ],
  metrics: [
    { id: "deal_count", label: "Deal count", aggregation: "count" },
    { id: "amount_sum", label: "Amount", aggregation: "sum", sourceField: "amountMinor" },
  ],
  defaultQuery: {
    exploreId: "sales-deals",
    dimensions: ["stage"],
    metrics: ["amount_sum"],
    filters: [],
    sorts: [{ fieldId: "amount_sum", dir: "desc" }],
    limit: 50,
  },
};

describe("analytics BI model helpers", () => {
  test("builds a cloned default query from an explore", () => {
    const query = defaultQuery(explore);
    expect(query.exploreId).toBe("sales-deals");
    expect(query.dimensions).toEqual(["stage"]);
    expect(query.metrics).toEqual(["amount_sum"]);
    expect(query.sorts).toEqual([{ fieldId: "amount_sum", dir: "desc" }]);

    query.dimensions.push("owner");
    expect(explore.defaultQuery?.dimensions).toEqual(["stage"]);
  });

  test("toggles fields without mutating the incoming query", () => {
    const query = defaultQuery(explore);
    const withOwner = toggleDimension(query, "owner");
    expect(withOwner.dimensions).toEqual(["stage", "owner"]);
    expect(query.dimensions).toEqual(["stage"]);

    const withoutMetric = toggleMetric(withOwner, "amount_sum");
    expect(withoutMetric.metrics).toEqual([]);
    expect(withOwner.metrics).toEqual(["amount_sum"]);
  });

  test("round-trips query state through the hash URL", () => {
    const query: MetricQuery = {
      ...defaultQuery(explore),
      filters: [{ fieldId: "stage", operator: "eq", value: "Won" }],
      tableCalculations: [{ id: "win_rate", label: "Win rate", expression: "amount_sum / deal_count" }],
    };
    const hash = explorePathForQuery(query);
    expect(hash.startsWith("/analytics/explore?q=")).toBe(true);
    expect(queryFromHash(hash, [explore])).toEqual(query);
    expect(serializeQueryState(query)).toContain("sales-deals");
  });

  test("drops malformed or unknown explore query state", () => {
    expect(queryFromHash("/analytics/explore?q=%7Bbad", [explore])).toBeNull();
    expect(queryFromHash("/analytics/explore?q=" + encodeURIComponent(JSON.stringify({ exploreId: "missing" })), [explore])).toBeNull();
  });

  test("search matching is case-insensitive and trimmed", () => {
    expect(matchesSearch("Pipeline Amount", " amount ")).toBe(true);
    expect(matchesSearch("Pipeline Amount", "revenue")).toBe(false);
  });
});
