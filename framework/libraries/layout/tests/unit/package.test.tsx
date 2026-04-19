import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DashboardGrid, SplitPanelLayout, WorkspaceShellLayout, packageId } from "../../src";

describe("layout", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("layout");
  });

  it("renders workspace and split-panel layouts", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(WorkspaceShellLayout, {
          sidebar: React.createElement("aside", null, "Sidebar"),
          main: React.createElement("main", null, "Main"),
          rail: React.createElement("aside", null, "Rail")
        }),
        React.createElement(DashboardGrid, { columns: 4 }, React.createElement("div", null, "Widget")),
        React.createElement(SplitPanelLayout, {
          left: React.createElement("aside", null, "Palette"),
          center: React.createElement("section", null, "Canvas"),
          right: React.createElement("aside", null, "Inspector")
        })
      )
    );

    expect(markup).toContain("Sidebar");
    expect(markup).toContain("Widget");
    expect(markup).toContain("Canvas");
  });
});
