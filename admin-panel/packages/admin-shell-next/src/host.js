/** Host layer — AdminRoot + usePluginHost. The application-level entrypoint
 *  that activates plugins, builds the registry, wires the shell, and renders
 *  the whole admin. Consumers typically call:
 *
 *    import { AdminRoot } from "@gutu/admin-shell-next/host";
 *    import { AuthGuard } from "@gutu/admin-shell-next/host";
 *
 *    <AuthGuard><AdminRoot plugins={plugins} /></AuthGuard>
 */
export { AdminRoot } from "../../../src/host/AdminRoot";
export { AuthGuard } from "../../../src/host/AuthGuard";
