import { jsx as _jsx } from "react/jsx-runtime";
import { defineCustomView } from "@/builders";
import { definePlugin } from "@/contracts/plugin-v2";
import { PluginInspectorPage } from "@/shell/PluginInspector";
/** Built-in plugin: the Plugin Inspector admin page. Installs itself as a
 *  v2 plugin so it's discoverable in the Inspector alongside every other
 *  plugin (recursion intended). */
export const pluginInspectorPlugin = definePlugin({
    manifest: {
        id: "shell.plugin-inspector",
        version: "1.0.0",
        label: "Plugin Inspector",
        description: "Manage installed plugins — view manifests, registries, contributions, install from URL, and reload or uninstall at runtime.",
        icon: "Package",
        requires: {
            shell: "*",
            capabilities: ["nav", "commands"],
        },
        origin: { kind: "explicit" },
    },
    async activate(ctx) {
        ctx.contribute.views([
            defineCustomView({
                id: "shell.plugin-inspector.view",
                title: "Plugins",
                description: "Manage installed plugins.",
                resource: "shell.plugin",
                render: () => _jsx(PluginInspectorPage, {}),
            }),
        ]);
        ctx.contribute.navSections([
            {
                id: "platform",
                label: "Platform",
                order: 100,
            },
        ]);
        ctx.contribute.nav([
            {
                id: "shell.plugin-inspector.nav",
                label: "Plugins",
                icon: "Package",
                path: "/settings/plugins",
                view: "shell.plugin-inspector.view",
                section: "platform",
                order: 90,
            },
        ]);
        ctx.contribute.commands([
            {
                id: "shell.go.plugins",
                label: "Plugins: Inspector",
                icon: "Package",
                run: () => {
                    window.location.hash = "/settings/plugins";
                },
            },
        ]);
    },
});
