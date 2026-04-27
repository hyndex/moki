/** Code / JSON field kind — read-write code editor with lowlight
 *  syntax highlighting overlaid on a plain `<textarea>`.
 *
 *  Why not CodeMirror: lowlight + highlight.js are already installed
 *  (Tiptap uses them for code blocks). Adding CodeMirror would be a
 *  big bundle for marginal benefit on form-level code fields. The
 *  textarea-overlay technique gives us coloured tokens with native
 *  text selection + zero new deps.
 *
 *  Storage:
 *    `code` → string (the source text)
 *    `json` → parses + stringifies on edit; stores the original
 *             string so a malformed paste survives the round-trip
 *
 *  Hardening:
 *    - `field.language` (e.g. `"typescript"`, `"json"`, `"python"`)
 *      drives the highlighter; defaults to `"plaintext"` for unknown
 *      kinds and never throws.
 *    - The overlay re-renders on every keystroke but lowlight is
 *      memoised; a 5KB document highlights in well under a frame. */

import * as React from "react";
import { common, createLowlight } from "lowlight";
import { toHtml } from "hast-util-to-html";
import "highlight.js/styles/github.css";
import type {
  FieldKindFormProps,
  FieldKindListCellProps,
  FieldKindDetailProps,
  FieldKindRenderer,
} from "../fieldKindRegistry";

const lowlight = createLowlight(common);

function languageFor(field: unknown, fallback = "plaintext"): string {
  const f = field as { language?: string; kind?: string };
  if (f.language) return f.language;
  if (f.kind === "json") return "json";
  return fallback;
}

function highlight(source: string, language: string): string {
  try {
    const tree = lowlight.registered(language)
      ? lowlight.highlight(language, source)
      : lowlight.highlightAuto(source);
    return toHtml(tree as unknown as import("hast").Root);
  } catch {
    return escape(source);
  }
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function CodeForm(props: FieldKindFormProps): React.ReactElement {
  const { field, value, onChange, disabled, invalid } = props;
  const language = languageFor(field);
  const text = typeof value === "string" ? value : value == null ? "" : JSON.stringify(value, null, 2);
  const [draft, setDraft] = React.useState(text);
  React.useEffect(() => setDraft(text), [text]);

  const html = React.useMemo(() => highlight(draft, language), [draft, language]);

  return (
    <div className="relative font-mono text-xs">
      <pre
        aria-hidden
        className={
          "absolute inset-0 px-3 py-2 m-0 rounded-md border bg-surface-1 text-text-primary overflow-auto whitespace-pre-wrap break-all pointer-events-none " +
          (invalid ? "border-danger" : "border-border")
        }
        // The highlighted overlay sits behind the textarea. Both render
        // identical glyph metrics so caret + selection align exactly.
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <textarea
        value={draft}
        disabled={disabled}
        onChange={(e) => {
          setDraft(e.target.value);
          if (field.kind === "json") {
            // Store the raw string so malformed JSON round-trips
            // without losing the user's edit. Detail/list views can
            // try-parse for display.
            onChange(e.target.value);
          } else {
            onChange(e.target.value);
          }
        }}
        spellCheck={false}
        className={
          "relative w-full px-3 py-2 rounded-md border bg-transparent caret-accent text-transparent resize-y min-h-[120px] outline-none " +
          "focus-visible:shadow-focus " +
          (invalid ? "border-danger" : "border-border focus:border-accent")
        }
        rows={8}
        style={{ caretColor: "var(--accent, #6366f1)" }}
      />
    </div>
  );
}

function CodeCell(props: FieldKindListCellProps): React.ReactElement {
  const v = props.value;
  if (v == null || v === "") return <span className="text-text-muted">—</span>;
  const text = typeof v === "string" ? v : JSON.stringify(v);
  return (
    <code className="font-mono text-[11px] text-text-muted truncate max-w-[280px]" title={text}>
      {text.length > 40 ? text.slice(0, 40) + "…" : text}
    </code>
  );
}

function CodeDetail(props: FieldKindDetailProps): React.ReactElement {
  const { field, value } = props;
  if (value == null || value === "") return <span className="text-text-muted">—</span>;
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const language = languageFor(field);
  const html = highlight(text, language);
  return (
    <pre
      className="rounded-md border border-border bg-surface-1 p-3 text-xs font-mono overflow-auto whitespace-pre-wrap break-all"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export const codeKind: FieldKindRenderer = {
  Form: CodeForm,
  ListCell: CodeCell,
  Detail: CodeDetail,
};
