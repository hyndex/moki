import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_ACTIVE } from "./_factory/options";
import { daysAgo, pick } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
const controlRoomView = buildCompactControlRoom({
    viewId: "runtime-bridge.control-room.view",
    resource: "runtime-bridge.channel",
    title: "Runtime Bridge Control Room",
    description: "Event bus, command dispatch, query channels.",
    kpis: [
        { label: "Active channels", resource: "runtime-bridge.channel",
            filter: { field: "status", op: "eq", value: "active" } },
        { label: "Messages (24h)", resource: "runtime-bridge.message", range: "last-30" },
        { label: "Subscribers", resource: "runtime-bridge.subscriber" },
    ],
    charts: [
        { label: "Channels by kind", resource: "runtime-bridge.channel", chart: "donut", groupBy: "kind" },
    ],
    shortcuts: [
        { label: "New channel", icon: "Plus", href: "/platform/runtime-bridges/new" },
    ],
});
export const runtimeBridgePlugin = buildDomainPlugin({
    id: "runtime-bridge",
    label: "Runtime Bridge",
    icon: "Radio",
    section: SECTIONS.platform,
    order: 5,
    resources: [
        {
            id: "channel",
            singular: "Channel",
            plural: "Channels",
            icon: "Radio",
            path: "/platform/runtime-bridges",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "kind", kind: "enum", options: [
                        { value: "event", label: "Event" }, { value: "command", label: "Command" },
                        { value: "query", label: "Query" },
                    ] },
                { name: "subscribers", kind: "number", align: "right" },
                { name: "messagesPerMin", kind: "number", align: "right" },
                { name: "status", kind: "enum", options: STATUS_ACTIVE },
                { name: "lastMessage", kind: "datetime", sortable: true },
            ],
            seedCount: 12,
            seed: (i) => ({
                name: pick(["orders.events", "crm.commands", "inventory.queries", "auth.events", "billing.events"], i),
                kind: pick(["event", "command", "query"], i),
                subscribers: 1 + (i * 3) % 10,
                messagesPerMin: 100 + (i * 37) % 1000,
                status: pick(["active", "active", "inactive"], i),
                lastMessage: daysAgo(i * 0.2),
            }),
        },
        {
            id: "subscriber",
            singular: "Subscriber",
            plural: "Subscribers",
            icon: "Users",
            path: "/platform/runtime-bridges/subscribers",
            fields: [
                { name: "channel", kind: "text", required: true, sortable: true },
                { name: "consumer", kind: "text" },
                { name: "lagMs", label: "Lag (ms)", kind: "number", align: "right" },
            ],
            seedCount: 20,
            seed: (i) => ({
                channel: pick(["orders.events", "crm.commands", "auth.events"], i),
                consumer: pick(["plugin-a", "plugin-b", "sync-worker", "analytics"], i),
                lagMs: 10 + (i * 7) % 500,
            }),
        },
        {
            id: "message",
            singular: "Message",
            plural: "Messages",
            icon: "MessageSquare",
            path: "/platform/runtime-bridges/messages",
            readOnly: true,
            displayField: "id",
            defaultSort: { field: "publishedAt", dir: "desc" },
            fields: [
                { name: "channel", kind: "text", sortable: true },
                { name: "kind", kind: "text" },
                { name: "publishedAt", kind: "datetime", sortable: true },
            ],
            seedCount: 50,
            seed: (i) => ({
                channel: pick(["orders.events", "crm.commands", "auth.events"], i),
                kind: pick(["order.created", "contact.updated", "auth.login"], i),
                publishedAt: daysAgo(i * 0.1),
            }),
        },
    ],
    extraNav: [
        { id: "runtime-bridge.control-room.nav", label: "Runtime Bridge Control Room", icon: "LayoutDashboard", path: "/platform/runtime-bridges/control-room", view: "runtime-bridge.control-room.view", order: 0 },
    ],
    extraViews: [controlRoomView],
    commands: [
        { id: "rb.go.control-room", label: "Runtime Bridge: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/platform/runtime-bridges/control-room"; } },
    ],
});
