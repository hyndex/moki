import { describe, expect, it } from "bun:test";
import { createPlatformEditorConfig, createPlatformEditorExtensions, editorContentSchema, packageId } from "../../src";

describe("ui-editor", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("ui-editor");
  });

  it("provides a starter extension set", () => {
    expect(createPlatformEditorExtensions().length).toBeGreaterThan(0);
  });

  it("creates editor configs with default editability", () => {
    expect(
      createPlatformEditorConfig({
        content: "<p>Hello</p>"
      }).editable
    ).toBe(true);
  });

  it("accepts string and json editor payloads", () => {
    expect(editorContentSchema.parse("<p>Hello</p>")).toBe("<p>Hello</p>");
    expect(
      editorContentSchema.parse({
        type: "doc",
        content: []
      })
    ).toEqual({
      type: "doc",
      content: []
    });
  });
});
