/** AppShell + navigation + global surfaces.
 *
 *  The AdminRoot host in ./host mounts this AppShell and wires it to the
 *  plugin registry, realtime bus, auth, and tenant context.
 */
export { AppShell } from "../../../src/shell/AppShell";
export { Sidebar } from "../../../src/shell/Sidebar";
export { Topbar } from "../../../src/shell/Topbar";
export { CommandPalette } from "../../../src/shell/CommandPalette";
export { Toaster } from "../../../src/shell/Toaster";
export { ConfirmHost } from "../../../src/shell/ConfirmHost";
export { ErrorBoundary } from "../../../src/shell/ErrorBoundary";
export { WorkspaceSwitcher } from "../../../src/shell/WorkspaceSwitcher";
export * from "../../../src/shell/registry";
export * from "../../../src/shell/router";
