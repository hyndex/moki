import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ReadOnlyEditorRenderer, createAdminEditorPreset, createReadOnlyEditorPreset, packageId } from "../../src";

describe("editor", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("editor");
  });

  it("creates editable and readonly presets with extension seams", () => {
    const editable = createAdminEditorPreset({
      mentions: true
    });
    const readonly = createReadOnlyEditorPreset({
      tables: false
    });

    expect(editable.seams.mentions).toBe(true);
    expect(readonly.editable).toBe(false);
    expect(readonly.seams.tables).toBe(false);
  });

  it("renders readonly editor content", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ReadOnlyEditorRenderer, {
        content: "Governed release note"
      })
    );

    expect(markup).toContain("Governed release note");
  });
});
