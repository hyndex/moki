---
plugin: gutu-plugin-editor-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Editor Core — Page Design Brief

Shared editor runtime under `document-editor-core`, `slides-core`,
`spreadsheet-core`, and `whiteboard-core` — manages Yjs binding,
presence, autosave, version history, comments.

## Pages

This plugin contributes no top-level pages. Exports primitives:

- `<EditorRoot>` — Yjs-backed root with presence + autosave + offline queue
- `<PresenceLayer>` — cursor / selection presence rendering
- `<VersionHistory>` — version slider + diff
- `<ConflictResolver>` — for merge edge cases

## UX rules

- Autosave debounced 800ms; explicit `Cmd-S` always saves immediately
- Offline → queue locally with visible indicator; replay on reconnect
- Idle timeout shows "still here?" check at 10min; resumes on activity

## Cross-plugin

- Foundation for slides / docs / sheets / whiteboard
- `audit-core` — every save produces an audit row + version

## Open

- Concurrent edit conflict UI — preview both sides; let user merge.
