import { describe, test, expect } from "bun:test";
import { inferArchetype } from "../inferArchetype";

describe("inferArchetype", () => {
  test("explicit archetype wins over inference", () => {
    const r = inferArchetype({
      archetype: "kanban",
      title: "This says dashboard but archetype is kanban",
    });
    expect(r.archetype).toBe("kanban");
    expect(r.explicit).toBe(true);
  });

  test("explicit fullBleed honoured", () => {
    expect(inferArchetype({ archetype: "dashboard", fullBleed: true }).fullBleed).toBe(true);
  });

  test("editor-canvas always fullBleed", () => {
    expect(inferArchetype({ archetype: "editor-canvas" }).fullBleed).toBe(true);
  });

  test("mode list → smart-list", () => {
    expect(inferArchetype({ mode: "list" }).archetype).toBe("smart-list");
  });

  test("mode kanban → kanban", () => {
    expect(inferArchetype({ mode: "kanban" }).archetype).toBe("kanban");
  });

  test("mode dashboard → dashboard", () => {
    expect(inferArchetype({ mode: "dashboard" }).archetype).toBe("dashboard");
  });

  test("title with 'dashboard' → dashboard", () => {
    expect(inferArchetype({ title: "Sales overview" }).archetype).toBe("dashboard");
    expect(inferArchetype({ title: "Sales dashboard" }).archetype).toBe("dashboard");
    expect(inferArchetype({ title: "Forecast" }).archetype).toBe("dashboard");
  });

  test("title with 'kanban'/'pipeline'/'board' → kanban", () => {
    expect(inferArchetype({ title: "Sales pipeline" }).archetype).toBe("kanban");
    expect(inferArchetype({ title: "Issues board" }).archetype).toBe("kanban");
  });

  test("title with 'calendar'/'schedule' → calendar", () => {
    expect(inferArchetype({ title: "Job schedule" }).archetype).toBe("calendar");
    expect(inferArchetype({ title: "Booking calendar" }).archetype).toBe("calendar");
  });

  test("title with 'tree'/'BOM'/'COA' → tree", () => {
    expect(inferArchetype({ title: "Bill of materials" }).archetype).toBe("tree");
    expect(inferArchetype({ title: "Chart of accounts" }).archetype).toBe("tree");
    expect(inferArchetype({ title: "Org chart" }).archetype).toBe("tree");
  });

  test("title with 'inbox' → split-inbox", () => {
    expect(inferArchetype({ title: "Inbox" }).archetype).toBe("split-inbox");
    expect(inferArchetype({ title: "Approvals" }).archetype).toBe("split-inbox");
  });

  test("title with 'audit'/'log'/'timeline' → timeline", () => {
    expect(inferArchetype({ title: "Audit log" }).archetype).toBe("timeline");
    expect(inferArchetype({ title: "Stock movements" }).archetype).toBe("timeline");
  });

  test("title with 'map'/'territory' → map", () => {
    expect(inferArchetype({ title: "Dispatch map" }).archetype).toBe("map");
    expect(inferArchetype({ title: "Sales territories" }).archetype).toBe("map");
  });

  test("title with 'slides'/'whiteboard'/'editor' → editor-canvas (full-bleed)", () => {
    const slides = inferArchetype({ title: "Slides" });
    expect(slides.archetype).toBe("editor-canvas");
    expect(slides.fullBleed).toBe(true);
    const wb = inferArchetype({ title: "Whiteboard" });
    expect(wb.archetype).toBe("editor-canvas");
    expect(wb.fullBleed).toBe(true);
  });

  test("title with 'all <noun>s' / 'list' → smart-list", () => {
    expect(inferArchetype({ title: "All contacts" }).archetype).toBe("smart-list");
    expect(inferArchetype({ title: "Customers list" }).archetype).toBe("smart-list");
    expect(inferArchetype({ title: "People" }).archetype).toBe("smart-list");
  });

  test("unknown shape falls back to detail-rich", () => {
    expect(inferArchetype({ title: "Settings" }).archetype).toBe("detail-rich");
    expect(inferArchetype({}).archetype).toBe("detail-rich");
    expect(inferArchetype(null).archetype).toBe("detail-rich");
  });

  test("inference is non-explicit", () => {
    expect(inferArchetype({ title: "Sales pipeline" }).explicit).toBe(false);
  });
});
