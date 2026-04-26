import { jsx as _jsx } from "react/jsx-runtime";
import { z } from "zod";
import { defineCustomView, defineResource } from "@/builders";
import { definePlugin } from "@/contracts/plugin-v2";
import { WebhooksPage } from "./webhooks-page";
import { ApiTokensPage } from "./api-tokens-page";
import { WorkflowsPage } from "./workflows-page";
import { WorkflowDetailPage } from "./workflow-detail";
import { CustomFieldsPage } from "./custom-fields-page";
/** Admin tools plugin — Settings-side surfaces for tenant-level
 *  developer admin: webhook subscriptions, long-lived API tokens, the
 *  visual workflows builder, and the custom-fields editor.
 *  Backend lives in admin-panel/backend/src/routes/{webhooks,api-tokens,workflows,field-metadata}.ts. */
// Resources are required to satisfy the view contract (`view.resource`)
// even though both pages render bespoke UIs — they don't read from the
// resource client.
const webhookResource = defineResource({
    id: "platform.webhook",
    singular: "Webhook",
    plural: "Webhooks",
    schema: z.object({ id: z.string() }).passthrough(),
    displayField: "targetUrl",
    icon: "Webhook",
});
const apiTokenResource = defineResource({
    id: "platform.api-token",
    singular: "API token",
    plural: "API tokens",
    schema: z.object({ id: z.string() }).passthrough(),
    displayField: "name",
    icon: "Key",
});
// Workflow resource — synthetic, satisfies the view contract and lets the
// shell's `resolveCustomDetailView` pair the list view with the detail
// view via the `<resource>.detail.view` id convention.
const workflowResource = defineResource({
    id: "admin.workflow",
    singular: "Workflow",
    plural: "Workflows",
    schema: z.object({ id: z.string() }).passthrough(),
    displayField: "name",
    icon: "Workflow",
});
const webhooksView = defineCustomView({
    id: "admin-tools.webhooks.view",
    title: "Webhooks",
    description: "Outbound event notifications to your endpoints.",
    resource: webhookResource.id,
    render: () => _jsx(WebhooksPage, {}),
});
const apiTokensView = defineCustomView({
    id: "admin-tools.api-tokens.view",
    title: "API tokens",
    description: "Long-lived bearer tokens for external integrations.",
    resource: apiTokenResource.id,
    render: () => _jsx(ApiTokensPage, {}),
});
const workflowsListView = defineCustomView({
    id: "admin-tools.workflows.view",
    title: "Workflows",
    description: "Visual automations — triggers + graphs of actions.",
    resource: workflowResource.id,
    render: () => _jsx(WorkflowsPage, {}),
});
// id matches `<resource>.detail.view` so the shell auto-mounts this for
// detail routes (`/settings/workflows/<id>`).
const workflowsDetailView = defineCustomView({
    id: `${workflowResource.id}.detail.view`,
    title: "Workflow",
    description: "Workflow detail: builder, runs, settings.",
    resource: workflowResource.id,
    render: () => _jsx(WorkflowDetailPage, {}),
});
// Custom fields — meta-resource so `defineCustomView`'s `resource`
// requirement is satisfied. Page reads/writes via /api/field-metadata.
const fieldMetadataResource = defineResource({
    id: "platform.field-metadata",
    singular: "Custom field",
    plural: "Custom fields",
    schema: z.object({ id: z.string() }).passthrough(),
    displayField: "label",
    icon: "Sparkles",
});
const customFieldsView = defineCustomView({
    id: "admin-tools.custom-fields.view",
    title: "Custom fields",
    description: "Per-resource metadata editor — add fields without a deploy.",
    resource: fieldMetadataResource.id,
    render: () => _jsx(CustomFieldsPage, {}),
});
const adminToolsNavSections = [
    { id: "settings", label: "Settings", order: 200 },
];
const adminToolsNav = [
    {
        id: "settings.custom-fields",
        label: "Custom fields",
        icon: "Sparkles",
        path: "/settings/custom-fields",
        view: "admin-tools.custom-fields.view",
        section: "settings",
        order: 1,
    },
    {
        id: "settings.workflows",
        label: "Workflows",
        icon: "Workflow",
        path: "/settings/workflows",
        view: "admin-tools.workflows.view",
        section: "settings",
        order: 5,
    },
    {
        id: "settings.webhooks",
        label: "Webhooks",
        icon: "Webhook",
        path: "/settings/webhooks",
        view: "admin-tools.webhooks.view",
        section: "settings",
        order: 10,
    },
    {
        id: "settings.api-tokens",
        label: "API tokens",
        icon: "Key",
        path: "/settings/api-tokens",
        view: "admin-tools.api-tokens.view",
        section: "settings",
        order: 20,
    },
];
const adminToolsCommands = [
    {
        id: "admin-tools.goto.custom-fields",
        label: "Open Custom fields",
        icon: "Sparkles",
        keywords: [
            "custom",
            "field",
            "metadata",
            "schema",
            "twenty",
            "settings",
        ],
        run: () => {
            window.location.hash = "/settings/custom-fields";
        },
    },
    {
        id: "admin-tools.goto.workflows",
        label: "Open Workflows",
        icon: "Workflow",
        keywords: ["workflow", "automation", "trigger", "schedule", "cron"],
        run: () => {
            window.location.hash = "/settings/workflows";
        },
    },
    {
        id: "admin-tools.goto.webhooks",
        label: "Open Webhook settings",
        icon: "Webhook",
        keywords: ["webhook", "integration", "notification", "endpoint"],
        run: () => {
            window.location.hash = "/settings/webhooks";
        },
    },
    {
        id: "admin-tools.goto.api-tokens",
        label: "Open API token settings",
        icon: "Key",
        keywords: ["token", "api", "bearer", "integration", "auth"],
        run: () => {
            window.location.hash = "/settings/api-tokens";
        },
    },
];
export const adminToolsPlugin = definePlugin({
    manifest: {
        id: "admin-tools",
        version: "0.1.0",
        label: "Admin Tools",
        description: "Settings-side surfaces for tenant administrators: webhook subscriptions, API tokens, workflows, and custom fields.",
        icon: "Settings",
        requires: {
            shell: "*",
            capabilities: [
                "nav",
                "commands",
                "fetch:external",
                // resources:read is required for ctx.contribute.resources, even
                // for synthetic shells that satisfy the view contract.
                "resources:read",
            ],
        },
        activationEvents: [{ kind: "onStart" }],
        origin: { kind: "explicit" },
    },
    async activate(ctx) {
        ctx.contribute.navSections(adminToolsNavSections);
        ctx.contribute.nav(adminToolsNav);
        ctx.contribute.resources([
            webhookResource,
            apiTokenResource,
            workflowResource,
            fieldMetadataResource,
        ]);
        ctx.contribute.views([
            webhooksView,
            apiTokensView,
            workflowsListView,
            workflowsDetailView,
            customFieldsView,
        ]);
        ctx.contribute.commands(adminToolsCommands);
    },
});
