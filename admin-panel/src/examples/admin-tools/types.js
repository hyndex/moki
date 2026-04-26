/** Workflow types — frontend-side mirror of
 *  `admin-panel/backend/src/lib/workflow/types.ts`.
 *
 *  Why mirror? The frontend `tsconfig` only includes `src/`, so importing
 *  the backend file directly would either pull the backend's full
 *  dependency surface into the browser bundle or fail TypeScript
 *  resolution. The two declarations describe the same JSON shape — the
 *  source of truth is the backend file; this file exists so the editor /
 *  REST client gets compile-time safety without coupling the build
 *  trees.
 *
 *  Keep in sync when the backend types change. The fields used by the UI
 *  are intentionally narrower than the backend's full shape — anything
 *  not consumed here is omitted to keep the surface small. */
export {};
