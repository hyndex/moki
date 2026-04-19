import { describe, expect, it } from "bun:test";

import {
  buildPostgresTsQuery,
  createSearchResultPage,
  highlightSearchText,
  packageId,
  scoreSearchHit,
  tokenizeSearchQuery
} from "../../src";

describe("search", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("search");
  });

  it("tokenizes and normalizes user queries", () => {
    expect(tokenizeSearchQuery("  Growth! Pipeline  ")).toEqual(["growth", "pipeline"]);
    expect(buildPostgresTsQuery("Growth Pipeline")).toBe("growth:* & pipeline:*");
  });

  it("highlights matching text and scores ranked hits", () => {
    const tokens = ["desk"];
    expect(highlightSearchText("Desk setup guide", tokens)).toBe("<mark>Desk</mark> setup guide");
    expect(
      scoreSearchHit(
        {
          id: "doc-1",
          title: "Desk setup guide",
          body: "How to configure a standing desk",
          tags: ["office"]
        },
        tokens
      )
    ).toBeGreaterThan(0);
  });

  it("creates paged search results with stable metadata", () => {
    expect(
      createSearchResultPage(
        {
          text: "desk",
          limit: 10,
          offset: 0
        },
        [],
        0
      )
    ).toEqual({
      total: 0,
      limit: 10,
      offset: 0,
      hits: []
    });
  });
});
