import type { Extensions, JSONContent } from "@tiptap/core";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { z } from "zod";

export const packageId = "ui-editor" as const;
export const packageDisplayName = "UI Editor" as const;
export const packageDescription = "Tiptap wrapper APIs." as const;

export const editorContentSchema = z.union([
  z.string(),
  z.object({
    type: z.string(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(z.unknown()).optional()
  })
]);

export type PlatformEditorContent = string | JSONContent;

export function createPlatformEditorExtensions(): Extensions {
  return [StarterKit.configure()];
}

export function createPlatformEditorConfig(input: {
  content?: PlatformEditorContent | undefined;
  editable?: boolean | undefined;
  extensions?: Extensions | undefined;
}) {
  return {
    editable: input.editable ?? true,
    extensions: input.extensions ?? createPlatformEditorExtensions(),
    ...(input.content === undefined ? {} : { content: input.content })
  };
}

export function usePlatformEditor(input: {
  content?: PlatformEditorContent | undefined;
  editable?: boolean | undefined;
  extensions?: Extensions | undefined;
}) {
  return useEditor(createPlatformEditorConfig(input));
}
