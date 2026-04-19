import React from "react";

import type { PlatformEditorContent } from "@platform/ui-editor";

export const packageId = "editor" as const;
export const packageDisplayName = "Editor" as const;
export const packageDescription = "Canonical Tiptap wrapper with read-only and extension preset seams." as const;

export * from "@platform/ui-editor";

export type PlatformEditorExtensionSeams = {
  mentions?: boolean | undefined;
  slashCommands?: boolean | undefined;
  tables?: boolean | undefined;
  mediaEmbeds?: boolean | undefined;
};

export type PlatformEditorPreset = {
  editable: boolean;
  seams: Required<PlatformEditorExtensionSeams>;
};

export function createAdminEditorPreset(seams: PlatformEditorExtensionSeams = {}): PlatformEditorPreset {
  return {
    editable: true,
    seams: {
      mentions: seams.mentions ?? true,
      slashCommands: seams.slashCommands ?? true,
      tables: seams.tables ?? true,
      mediaEmbeds: seams.mediaEmbeds ?? true
    }
  };
}

export function createReadOnlyEditorPreset(seams: PlatformEditorExtensionSeams = {}): PlatformEditorPreset {
  return {
    ...createAdminEditorPreset(seams),
    editable: false
  };
}

export function renderReadOnlyEditorContent(content: PlatformEditorContent): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content.content)) {
    return content.content.map(readEditorTextEntry).filter(Boolean).join(" ").trim();
  }

  return JSON.stringify(content);
}

export function ReadOnlyEditorRenderer(props: {
  content: PlatformEditorContent;
}) {
  return React.createElement(
    "article",
    {
      className: "awb-readonly-editor",
      "data-testid": "readonly-editor"
    },
    renderReadOnlyEditorContent(props.content)
  );
}

function readEditorTextEntry(entry: unknown): string {
  if (typeof entry === "string") {
    return entry;
  }
  if (typeof entry !== "object" || entry === null || !("text" in entry)) {
    return "";
  }

  const text = (entry as { text?: unknown }).text;
  return typeof text === "string" ? text : "";
}
