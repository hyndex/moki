import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ErrorState,
  LoadingState,
  PlatformIcon,
  PlatformToaster,
  ToastStack,
  createMemoryToastDispatcher,
  createToastController,
  formatPlatformDate,
  formatPlatformDateTime,
  formatPlatformRelativeTime,
  packageId
} from "../../src";

describe("ui", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("ui");
  });

  it("formats dates through shared date helpers", () => {
    expect(formatPlatformDate("2026-04-19T10:00:00.000Z")).toContain("2026");
    expect(formatPlatformDateTime("2026-04-19T10:00:00.000Z")).toContain("2026");
    expect(formatPlatformRelativeTime(new Date(Date.now() - 60_000))).toContain("ago");
  });

  it("resolves icons and toasts through shared adapters", () => {
    const dispatcher = createMemoryToastDispatcher();
    const controller = createToastController(dispatcher.dispatch);
    controller.success({
      title: "Saved",
      description: "The dashboard view was saved."
    });

    const markup = renderToStaticMarkup(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(PlatformIcon, { name: "layout-grid", size: 16 }),
        React.createElement(PlatformToaster, null),
        React.createElement(ToastStack, { toasts: dispatcher.history }),
        React.createElement(LoadingState, { title: "Loading desk" }),
        React.createElement(ErrorState, { description: "No data source is available." })
      )
    );

    expect(dispatcher.history).toHaveLength(1);
    expect(dispatcher.history[0]?.intent).toBe("success");
    expect(markup).toContain("Loading desk");
    expect(markup).toContain("No data source is available.");
  });
});
