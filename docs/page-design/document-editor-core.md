---
plugin: gutu-plugin-document-editor-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Document Editor — Page Design Brief

Rich-text editor primitives shared by `collab-pages-core`, `content-core`, mail composer, and any plugin needing prose.

## Pages

This plugin contributes no top-level pages. It exports the editor and toolbar components used by other plugins. Provides:

- `<RichEditor>` — rich-text canvas
- `<EditorToolbar>` — composable toolbar
- `<SlashMenu>` — block insertion via `/`
- `<MentionMenu>` — `@` mentions
- `<CommentLayer>` — inline comments
- `<AiCoauthor>` — AI side panel

## UX rules

- Cmd-K opens command palette (always)
- Cmd-S explicit save (always supported even when autosave is on)
- Cmd-Z / Cmd-Shift-Z undo / redo (always)
- All blocks keyboard-navigable; arrow keys move cursor across blocks
- Slash menu always shows top-level commands first; categorised below

## Cross-plugin

- Used by all editor canvas archetype pages

## Open

- Pluggable block types — phase 1 yes; plugins can register new block types via `EditorBlockRegistry`.
