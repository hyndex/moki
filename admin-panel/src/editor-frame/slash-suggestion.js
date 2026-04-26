/** TipTap extension that triggers a slash menu when the user types `/`
 *  at the start of a line. Uses TipTap's `Suggestion` plugin (the same
 *  one mentions / hashtags use) so we get character capture, query
 *  filtering, and Enter/Esc/Arrow handling for free. The popup itself
 *  is positioned by `tippy.js` and renders the React `SlashMenuList`
 *  via a manual ReactDOM root. */
import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import tippy from "tippy.js";
import { filterSlashItems, SlashMenuList, } from "./SlashMenu";
export function createSlashSuggestion() {
    return Extension.create({
        name: "slash-command",
        addOptions() {
            return {
                suggestion: {
                    char: "/",
                    allowSpaces: true,
                    startOfLine: false,
                    // Don't trigger inside code or codeBlock — `/` is legitimate there.
                    allow: ({ editor, range }) => {
                        const $from = editor.state.doc.resolve(range.from);
                        const isInCodeBlock = $from.parent.type.name === "codeBlock";
                        const isCodeMark = editor.isActive("code");
                        return !isInCodeBlock && !isCodeMark;
                    },
                    items: ({ query }) => filterSlashItems(query).slice(0, 12),
                    render: () => {
                        let component = null;
                        let popup = null;
                        return {
                            onStart: async (props) => {
                                // Lazy-import ReactRenderer to avoid loading it for users
                                // who never trigger the slash menu (keeps initial editor
                                // bundle smaller).
                                const { ReactRenderer } = await import("@tiptap/react");
                                // ReactRenderer's generic constraint expects the props
                                // of the rendered component (including RefAttributes).
                                // Cast through a structural subset — we only call
                                // `.element`, `.ref`, `.updateProps`, `.destroy` on it.
                                component = new ReactRenderer(SlashMenuList, {
                                    props,
                                    editor: props.editor,
                                });
                                if (!props.clientRect)
                                    return;
                                popup = tippy("body", {
                                    getReferenceClientRect: props.clientRect,
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
                            onUpdate(props) {
                                component?.updateProps(props);
                                if (popup && props.clientRect) {
                                    popup[0]?.setProps({
                                        getReferenceClientRect: props.clientRect,
                                    });
                                }
                            },
                            onKeyDown(props) {
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
                    command: ({ editor, range, props, }) => {
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
