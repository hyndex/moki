/** TipTap extension that triggers a slash menu when the user types `/`
 *  at the start of a line. Uses TipTap's `Suggestion` plugin (the same
 *  one mentions / hashtags use) so we get character capture, query
 *  filtering, and Enter/Esc/Arrow handling for free. The popup itself
 *  is positioned by `tippy.js` and renders the React `SlashMenuList`
 *  via a manual ReactDOM root. */
import { Extension, type Editor, type Range } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import {
  filterSlashItems,
  SlashMenuList,
  type SlashMenuItem,
} from "./SlashMenu";

interface SlashRendererProps {
  editor: Editor;
  range: Range;
  query: string;
  text: string;
  items: SlashMenuItem[];
  command: (item: SlashMenuItem) => void;
  decorationNode: HTMLElement | null;
  clientRect?: () => DOMRect | null;
}

/** Minimal slice of `@tiptap/react`'s ReactRenderer we use. Avoids
 *  having to align our `SlashRendererProps` with their generic
 *  parameter (which is the props of the rendered component including
 *  RefAttributes — would need a forwardRef-aware adapter). */
interface RendererLike {
  element: HTMLElement;
  ref: { onKeyDown: (props: { event: KeyboardEvent }) => boolean } | null;
  updateProps(props: Record<string, unknown>): void;
  destroy(): void;
}

export function createSlashSuggestion(): Extension {
  return Extension.create({
    name: "slash-command",

    addOptions() {
      return {
        suggestion: {
          char: "/",
          allowSpaces: true,
          startOfLine: false,
          // Don't trigger inside code or codeBlock — `/` is legitimate there.
          allow: ({ editor, range }: { editor: Editor; range: Range }) => {
            const $from = editor.state.doc.resolve(range.from);
            const isInCodeBlock = $from.parent.type.name === "codeBlock";
            const isCodeMark = editor.isActive("code");
            return !isInCodeBlock && !isCodeMark;
          },
          items: ({ query }: { query: string }) => filterSlashItems(query).slice(0, 12),

          render: () => {
            let component: RendererLike | null = null;
            let popup: TippyInstance[] | null = null;

            return {
              onStart: async (props: SlashRendererProps) => {
                // Lazy-import ReactRenderer to avoid loading it for users
                // who never trigger the slash menu (keeps initial editor
                // bundle smaller).
                const { ReactRenderer } = await import("@tiptap/react");
                // ReactRenderer's generic constraint expects the props
                // of the rendered component (including RefAttributes).
                // Cast through a structural subset — we only call
                // `.element`, `.ref`, `.updateProps`, `.destroy` on it.
                component = new (ReactRenderer as unknown as new (
                  cmp: typeof SlashMenuList,
                  opts: { props: SlashRendererProps; editor: Editor },
                ) => RendererLike)(SlashMenuList, {
                  props,
                  editor: props.editor,
                });

                if (!props.clientRect) return;

                popup = tippy("body", {
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                  theme: "light-border",
                  arrow: false,
                  offset: [0, 6],
                  maxWidth: "none",
                });
              },

              onUpdate(props: SlashRendererProps) {
                component?.updateProps(props as unknown as Record<string, unknown>);
                if (popup && props.clientRect) {
                  popup[0]?.setProps({
                    getReferenceClientRect: props.clientRect as () => DOMRect,
                  });
                }
              },

              onKeyDown(props: { event: KeyboardEvent }) {
                if (props.event.key === "Escape") {
                  popup?.[0]?.hide();
                  return true;
                }
                return component?.ref?.onKeyDown(props) ?? false;
              },

              onExit() {
                popup?.[0]?.destroy();
                component?.destroy();
                popup = null;
                component = null;
              },
            };
          },

          command: ({
            editor,
            range,
            props,
          }: {
            editor: Editor;
            range: Range;
            props: SlashMenuItem;
          }) => {
            props.command({ editor, range });
          },
        },
      };
    },

    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          ...this.options.suggestion,
        }),
      ];
    },
  });
}
