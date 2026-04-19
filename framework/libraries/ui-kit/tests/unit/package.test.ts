import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  BulkActionBar,
  CommandDialog,
  DrawerInspector,
  FilterBar,
  MetricCard,
  ObjectHeader,
  PermissionBoundary,
  SavedViewSelector,
  TimelinePanel,
  WizardStepper,
  cn,
  packageId
} from "../../src";

describe("ui-kit", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("ui-kit");
  });

  it("merges utility classes predictably", () => {
    expect(cn("px-2", "px-4", "text-slate-900")).toBe("px-4 text-slate-900");
  });

  it("renders permission-aware boundaries", () => {
    const allowed = renderToStaticMarkup(
      React.createElement(
        PermissionBoundary,
        { grants: ["crm.contacts.read"], require: "crm.contacts.read" },
        React.createElement("span", null, "Visible")
      )
    );

    const denied = renderToStaticMarkup(
      React.createElement(
        PermissionBoundary,
        {
          grants: [],
          require: "crm.contacts.read",
          fallback: React.createElement("span", null, "Hidden")
        },
        React.createElement("span", null, "Visible")
      )
    );

    expect(allowed).toContain("Visible");
    expect(denied).toContain("Hidden");
  });

  it("renders metric cards with semantic tones", () => {
    const markup = renderToStaticMarkup(React.createElement(MetricCard, { label: "MRR", value: "$12k", tone: "positive" }));
    expect(markup).toContain("MRR");
    expect(markup).toContain("$12k");
  });

  it("renders admin desk primitives", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(ObjectHeader, { title: "Contacts", subtitle: "Pipeline owners and accounts" }),
        React.createElement(FilterBar, { summary: "3 filters applied" }),
        React.createElement(SavedViewSelector, {
          views: [
            { id: "default", label: "Default", active: true },
            { id: "mql", label: "High MQL" }
          ]
        }),
        React.createElement(TimelinePanel, {
          entries: [{ id: "evt-1", title: "Created", at: "2026-01-01T00:00:00.000Z" }]
        }),
        React.createElement(CommandDialog, {
          query: "create account",
          items: [{ id: "crm.account.new", label: "Create Account" }]
        }),
        React.createElement(WizardStepper, {
          steps: [
            { id: "draft", label: "Draft", status: "complete" },
            { id: "review", label: "Review", status: "current" }
          ]
        }),
        React.createElement(DrawerInspector, { title: "Inspector" }, "Inspect"),
        React.createElement(BulkActionBar, { selectedCount: 2, actions: React.createElement("button", null, "Archive") })
      )
    );

    expect(markup).toContain("Contacts");
    expect(markup).toContain("3 filters applied");
    expect(markup).toContain("Create Account");
    expect(markup).toContain("2 selected");
  });
});
