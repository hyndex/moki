# Loyalty Program

A plugin for the gutu admin panel.

## Developing

Drop this folder anywhere under `admin-panel/src/plugins/`. The shell
auto-discovers it via `import.meta.glob` on the next dev-server restart.

## Contributing views, resources, actions

See `src/plugins/warehouse/index.tsx` for a full end-to-end example.

## Manifest

Declare `capabilities` the plugin needs so the shell can enforce them:

- `nav` — contribute sidebar nav
- `commands` — contribute command-palette entries
- `resources:read/write/delete` — read + mutate records
- `shortcuts` — register keyboard shortcuts
- `register:field-kind` — extend the fieldKinds registry
- `fetch:external` — make cross-origin requests


---

# Plugin manifest

- `id`: com.gutu.loyalty
- `label`: Loyalty Program
- `version`: 0.1.0
