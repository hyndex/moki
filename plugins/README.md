## Plugins Directory

This repository no longer ships the optional plugin catalog as checked-in source.

`plugins/` is reserved for:

- future vendored installs from the platform plugin store,
- temporary local plugin development that is intentionally kept outside the core framework distribution,
- import or review of external packages before promotion into a separate plugin repository.

The shipped framework source lives in:

- `framework/core/`
- `framework/libraries/`
- `framework/builtin-plugins/`

If you are building the framework itself, keep this directory empty except for placeholder files like this one.
