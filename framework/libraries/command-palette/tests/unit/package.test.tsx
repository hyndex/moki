import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  PlatformCommandPalette,
  filterCommandPaletteItems,
  groupCommandPaletteItems,
  packageId,
  rankCommandPaletteItems
} from "../../src";

const items = [
  {
    id: "crm.contacts.open",
    label: "Open CRM Contacts",
    group: "Navigation",
    keywords: ["crm", "contacts"],
    permission: "crm.contacts.read"
  },
  {
    id: "dashboard.builder.open",
    label: "Open Report Builder",
    group: "Builders",
    keywords: ["reports", "builder"],
    permission: "dashboard.builders.use"
  }
];

describe("command-palette", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("command-palette");
  });

  it("ranks, filters, and groups command items", () => {
    const ranked = rankCommandPaletteItems("report", items);
    const filtered = filterCommandPaletteItems({
      query: "open",
      items,
      grantedPermissions: ["crm.contacts.read"]
    });
    const groups = groupCommandPaletteItems(items);

    expect(ranked[0]?.id).toBe("dashboard.builder.open");
    expect(filtered).toHaveLength(1);
    expect(groups).toHaveLength(2);
  });

  it("renders a cmdk-backed palette", () => {
    const markup = renderToStaticMarkup(
      React.createElement(PlatformCommandPalette, {
        query: "contacts",
        items
      })
    );

    expect(markup).toContain("Command palette");
    expect(markup).toContain("Open CRM Contacts");
  });
});
