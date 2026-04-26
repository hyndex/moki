import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { CURRENCY } from "./_factory/options";
import { daysAgo, daysFromNow, money, pick } from "./_factory/seeds";
import { treasuryCashView } from "./treasury-pages";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const controlRoomView = buildCompactControlRoom({
    viewId: "treasury.control-room.view",
    resource: "treasury.account",
    title: "Treasury Control Room",
    description: "Cash position, transfers, FX pulse.",
    kpis: [
        { label: "Bank accounts", resource: "treasury.account" },
        { label: "Total balance", resource: "treasury.account", fn: "sum", field: "balance", format: "currency" },
        { label: "Transfers pending", resource: "treasury.transfer",
            filter: { field: "status", op: "eq", value: "pending" } },
        { label: "FX exposure", resource: "treasury.fx-position",
            fn: "sum", field: "exposure", format: "currency" },
    ],
    charts: [
        { label: "Balance by currency", resource: "treasury.account", chart: "donut", groupBy: "currency", fn: "sum", field: "balance" },
        { label: "Balance by bank", resource: "treasury.account", chart: "bar", groupBy: "bank", fn: "sum", field: "balance" },
    ],
    shortcuts: [
        { label: "New transfer", icon: "ArrowLeftRight", href: "/treasury/transfers/new" },
        { label: "Cash position", icon: "PiggyBank", href: "/treasury/cash" },
        { label: "Forecasts", icon: "LineChart", href: "/treasury/forecasts" },
        { label: "Reports", icon: "BarChart3", href: "/treasury/reports" },
    ],
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const cashPositionReport = {
    id: "cash-position", label: "Cash Position",
    description: "Cash balance per bank account + currency.",
    icon: "PiggyBank", resource: "treasury.account", filters: [],
    async execute({ resources }) {
        const accounts = await fetchAll(resources, "treasury.account");
        const rows = accounts.map((a) => ({
            name: str(a.name),
            bank: str(a.bank),
            currency: str(a.currency),
            balance: num(a.balance),
            available: num(a.availableBalance) || num(a.balance),
        })).sort((a, b) => b.balance - a.balance);
        return {
            columns: [
                { field: "name", label: "Account", fieldtype: "text" },
                { field: "bank", label: "Bank", fieldtype: "text" },
                { field: "currency", label: "Currency", fieldtype: "enum" },
                { field: "balance", label: "Balance", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "available", label: "Available", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
        };
    },
};
const transfersReport = {
    id: "transfers", label: "Transfers",
    description: "Recent transfers, pending + settled.",
    icon: "ArrowLeftRight", resource: "treasury.transfer", filters: [],
    async execute({ resources }) {
        const transfers = await fetchAll(resources, "treasury.transfer");
        const rows = transfers.map((t) => ({
            from: str(t.from),
            to: str(t.to),
            amount: num(t.amount),
            status: str(t.status),
            initiatedAt: str(t.initiatedAt),
        })).sort((a, b) => b.initiatedAt.localeCompare(a.initiatedAt));
        return {
            columns: [
                { field: "from", label: "From", fieldtype: "text" },
                { field: "to", label: "To", fieldtype: "text" },
                { field: "amount", label: "Amount", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "status", label: "Status", fieldtype: "enum" },
                { field: "initiatedAt", label: "Initiated", fieldtype: "datetime" },
            ],
            rows,
        };
    },
};
const fxReport = {
    id: "fx-exposure", label: "FX Exposure",
    description: "Currency exposure per position.",
    icon: "Coins", resource: "treasury.fx-position", filters: [],
    async execute({ resources }) {
        const positions = await fetchAll(resources, "treasury.fx-position");
        const rows = positions.map((p) => ({
            pair: str(p.pair),
            notional: num(p.notional),
            exposure: num(p.exposure),
            hedged: p.hedged ? "Yes" : "No",
            maturityAt: str(p.maturityAt),
        })).sort((a, b) => b.exposure - a.exposure);
        return {
            columns: [
                { field: "pair", label: "Pair", fieldtype: "text" },
                { field: "notional", label: "Notional", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "exposure", label: "Exposure", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "hedged", label: "Hedged", fieldtype: "text" },
                { field: "maturityAt", label: "Maturity", fieldtype: "date" },
            ],
            rows,
        };
    },
};
const { indexView: reportsIndex, detailView: reportsDetail } = buildReportLibrary({
    indexViewId: "treasury.reports.view",
    detailViewId: "treasury.reports-detail.view",
    resource: "treasury.account",
    title: "Treasury Reports",
    description: "Cash position, transfers, FX exposure.",
    basePath: "/treasury/reports",
    reports: [cashPositionReport, transfersReport, fxReport],
});
export const treasuryPlugin = buildDomainPlugin({
    id: "treasury",
    label: "Treasury",
    icon: "Vault",
    section: SECTIONS.finance,
    order: 4,
    resources: [
        {
            id: "account",
            singular: "Bank Account",
            plural: "Bank Accounts",
            icon: "Landmark",
            path: "/treasury/accounts",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "bank", kind: "text", required: true, sortable: true },
                { name: "iban", kind: "text" },
                { name: "swift", kind: "text" },
                { name: "currency", kind: "enum", options: CURRENCY, sortable: true, width: 100 },
                { name: "balance", kind: "currency", align: "right", sortable: true },
                { name: "availableBalance", kind: "currency", align: "right" },
                { name: "holdAmount", kind: "currency", align: "right" },
            ],
            seedCount: 10,
            seed: (i) => {
                const balance = money(i, 10000, 500000);
                return {
                    name: pick(["Ops USD", "Reserve EUR", "Payroll USD", "Operating GBP", "Tax USD", "M&A USD"], i),
                    bank: pick(["Chase", "HSBC", "Barclays", "Wise", "Mercury"], i),
                    iban: `GB${String(10 + i).padStart(2, "0")}CHAS${String(60161331268500 + i * 7).slice(-14)}`,
                    swift: pick(["CHASUS33", "MIDLGB22", "BARCGB22", "TRWIUS35"], i),
                    currency: pick(["USD", "EUR", "GBP"], i),
                    balance,
                    availableBalance: balance - (i * 100),
                    holdAmount: i * 100,
                };
            },
        },
        {
            id: "transfer",
            singular: "Transfer",
            plural: "Transfers",
            icon: "ArrowLeftRight",
            path: "/treasury/transfers",
            displayField: "code",
            defaultSort: { field: "initiatedAt", dir: "desc" },
            fields: [
                { name: "code", kind: "text", sortable: true },
                { name: "from", kind: "text", required: true, sortable: true },
                { name: "to", kind: "text", required: true, sortable: true },
                { name: "amount", kind: "currency", align: "right", required: true, sortable: true },
                { name: "currency", kind: "text", width: 90 },
                { name: "purpose", kind: "text" },
                { name: "status", kind: "enum", options: [
                        { value: "pending", label: "Pending", intent: "warning" },
                        { value: "in-transit", label: "In transit", intent: "info" },
                        { value: "settled", label: "Settled", intent: "success" },
                        { value: "failed", label: "Failed", intent: "danger" },
                    ] },
                { name: "initiatedAt", kind: "datetime", sortable: true },
                { name: "settledAt", kind: "datetime" },
            ],
            seedCount: 20,
            seed: (i) => ({
                code: `TFR-${String(1000 + i).slice(-4)}`,
                from: pick(["Ops USD", "Reserve EUR"], i),
                to: pick(["Payroll USD", "Operating GBP"], i + 1),
                amount: money(i, 1000, 50000),
                currency: pick(["USD", "EUR", "GBP"], i),
                purpose: pick(["Payroll", "Vendor payment", "Tax", "Treasury sweep"], i),
                status: pick(["pending", "settled", "settled", "settled", "in-transit", "failed"], i),
                initiatedAt: daysAgo(i),
                settledAt: daysAgo(i - 0.1),
            }),
        },
        {
            id: "fx-position",
            singular: "FX Position",
            plural: "FX Positions",
            icon: "Coins",
            path: "/treasury/fx-positions",
            fields: [
                { name: "pair", kind: "text", required: true, sortable: true },
                { name: "notional", kind: "currency", align: "right", sortable: true },
                { name: "exposure", kind: "currency", align: "right", sortable: true },
                { name: "hedged", kind: "boolean" },
                { name: "maturityAt", kind: "date" },
            ],
            seedCount: 6,
            seed: (i) => ({
                pair: pick(["USD/EUR", "USD/GBP", "EUR/GBP", "USD/INR", "USD/JPY", "EUR/USD"], i),
                notional: 100_000 + i * 50_000,
                exposure: 50_000 + i * 20_000,
                hedged: i % 2 === 0,
                maturityAt: daysFromNow(30 + i * 15),
            }),
        },
        {
            id: "cash-forecast",
            singular: "Cash Forecast",
            plural: "Cash Forecasts",
            icon: "LineChart",
            path: "/treasury/forecasts",
            fields: [
                { name: "period", kind: "text", required: true, sortable: true },
                { name: "openingBalance", kind: "currency", align: "right" },
                { name: "inflows", kind: "currency", align: "right" },
                { name: "outflows", kind: "currency", align: "right" },
                { name: "closingBalance", kind: "currency", align: "right" },
                { name: "confidence", kind: "enum", options: [
                        { value: "high", label: "High", intent: "success" },
                        { value: "medium", label: "Medium", intent: "warning" },
                        { value: "low", label: "Low", intent: "danger" },
                    ] },
            ],
            seedCount: 12,
            seed: (i) => {
                const opening = 500_000 + i * 50_000;
                const inflow = 200_000 + i * 20_000;
                const outflow = 150_000 + i * 15_000;
                return {
                    period: `2026-${String(((i % 12) + 1)).padStart(2, "0")}`,
                    openingBalance: opening,
                    inflows: inflow,
                    outflows: outflow,
                    closingBalance: opening + inflow - outflow,
                    confidence: pick(["high", "medium", "low"], i),
                };
            },
        },
    ],
    extraNav: [
        { id: "treasury.control-room.nav", label: "Treasury Control Room", icon: "LayoutDashboard", path: "/treasury/control-room", view: "treasury.control-room.view", order: 0 },
        { id: "treasury.reports.nav", label: "Reports", icon: "BarChart3", path: "/treasury/reports", view: "treasury.reports.view" },
        { id: "treasury.cash.nav", label: "Cash position", icon: "PiggyBank", path: "/treasury/cash", view: "treasury.cash.view" },
    ],
    extraViews: [controlRoomView, reportsIndex, reportsDetail, treasuryCashView],
    commands: [
        { id: "treasury.go.control-room", label: "Treasury: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/treasury/control-room"; } },
        { id: "treasury.go.reports", label: "Treasury: Reports", icon: "BarChart3", run: () => { window.location.hash = "/treasury/reports"; } },
        { id: "treasury.new-transfer", label: "New transfer", icon: "ArrowLeftRight", run: () => { window.location.hash = "/treasury/transfers/new"; } },
    ],
});
