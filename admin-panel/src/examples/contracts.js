import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_LIFECYCLE } from "./_factory/options";
import { COMPANIES, code, daysAgo, daysFromNow, money, pick } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
const controlRoomView = buildCompactControlRoom({
    viewId: "contracts.control-room.view",
    resource: "contracts.contract",
    title: "Contracts Control Room",
    description: "Contracts pipeline and expiry.",
    kpis: [
        { label: "Active", resource: "contracts.contract",
            filter: { field: "status", op: "eq", value: "published" } },
        { label: "Pending signature", resource: "contracts.contract",
            filter: { field: "status", op: "eq", value: "pending" } },
        { label: "Expiring (60d)", resource: "contracts.contract",
            filter: { field: "expiringSoon", op: "eq", value: true } },
        { label: "Total value", resource: "contracts.contract", fn: "sum", field: "value", format: "currency" },
    ],
    charts: [
        { label: "Contracts by status", resource: "contracts.contract", chart: "donut", groupBy: "status" },
        { label: "Value by type", resource: "contracts.contract", chart: "bar", groupBy: "kind", fn: "sum", field: "value" },
    ],
    shortcuts: [
        { label: "New contract", icon: "Plus", href: "/contracts/new" },
        { label: "Templates", icon: "FileText", href: "/contracts/templates" },
    ],
});
export const contractsPlugin = buildDomainPlugin({
    id: "contracts",
    label: "Contracts",
    icon: "FileSignature",
    section: SECTIONS.workspace,
    order: 4,
    resources: [
        {
            id: "contract",
            singular: "Contract",
            plural: "Contracts",
            icon: "FileSignature",
            path: "/contracts",
            displayField: "name",
            fields: [
                { name: "code", kind: "text", sortable: true },
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "counterparty", kind: "text", sortable: true },
                { name: "kind", label: "Type", kind: "enum", options: [
                        { value: "MSA", label: "MSA" }, { value: "NDA", label: "NDA" },
                        { value: "Order Form", label: "Order Form" }, { value: "DPA", label: "DPA" },
                        { value: "SOW", label: "SOW" },
                    ] },
                { name: "value", kind: "currency", align: "right", sortable: true },
                { name: "status", kind: "enum", options: STATUS_LIFECYCLE, sortable: true },
                { name: "signedAt", kind: "date" },
                { name: "expiresAt", kind: "date", sortable: true },
                { name: "expiringSoon", kind: "boolean" },
                { name: "owner", kind: "text" },
            ],
            seedCount: 20,
            seed: (i) => {
                const expires = daysFromNow(-60 + (i * 13) % 365);
                return {
                    code: code("CTR", i, 5),
                    name: `${pick(["MSA", "NDA", "Order Form", "DPA", "SOW"], i)} — ${pick(COMPANIES, i)}`,
                    counterparty: pick(COMPANIES, i),
                    kind: pick(["MSA", "NDA", "Order Form", "DPA", "SOW"], i),
                    value: money(i, 1000, 500_000),
                    status: pick(["draft", "pending", "approved", "published"], i),
                    signedAt: daysAgo(30 + i),
                    expiresAt: expires,
                    expiringSoon: (Date.parse(expires) - Date.now()) / 86_400_000 < 60,
                    owner: "sam@gutu.dev",
                };
            },
        },
        {
            id: "template",
            singular: "Template",
            plural: "Templates",
            icon: "FileText",
            path: "/contracts/templates",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "kind", kind: "enum", options: [
                        { value: "MSA", label: "MSA" }, { value: "NDA", label: "NDA" },
                        { value: "Order Form", label: "Order Form" }, { value: "DPA", label: "DPA" },
                        { value: "SOW", label: "SOW" },
                    ] },
                { name: "version", kind: "text" },
                { name: "active", kind: "boolean" },
            ],
            seedCount: 6,
            seed: (i) => ({
                name: pick(["Master Services Agreement v3", "NDA v2", "Order Form v4", "DPA 2024"], i),
                kind: pick(["MSA", "NDA", "Order Form", "DPA", "SOW"], i),
                version: `v${1 + (i % 5)}`,
                active: true,
            }),
        },
    ],
    extraNav: [
        { id: "contracts.control-room.nav", label: "Contracts Control Room", icon: "LayoutDashboard", path: "/contracts/control-room", view: "contracts.control-room.view", order: 0 },
    ],
    extraViews: [controlRoomView],
    commands: [
        { id: "contracts.go.control-room", label: "Contracts: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/contracts/control-room"; } },
        { id: "contracts.new", label: "New contract", icon: "Plus", run: () => { window.location.hash = "/contracts/new"; } },
    ],
});
