import { buildControlRoom } from "./_factory/controlRoomHelper";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const workspace = {
    id: "auth.control-room",
    label: "Auth & Security Control Room",
    filterBar: [
        {
            field: "status",
            label: "Status",
            kind: "enum",
            appliesTo: ["auth.user"],
            options: [
                { value: "active", label: "Active" },
                { value: "invited", label: "Invited" },
                { value: "suspended", label: "Suspended" },
                { value: "disabled", label: "Disabled" },
            ],
        },
        { field: "role", label: "Role", kind: "text" },
    ],
    widgets: [
        { id: "h1", type: "header", col: 12, label: "Identity pulse", level: 2 },
        { id: "k-users", type: "number_card", col: 3, label: "Users",
            aggregation: { resource: "auth.user", fn: "count",
                filter: { field: "status", op: "eq", value: "active" } },
            drilldown: "/auth/users" },
        { id: "k-mfa", type: "number_card", col: 3, label: "MFA enrolled %",
            aggregation: { resource: "auth.user", fn: "avg", field: "mfaEnrolledNumeric" } },
        { id: "k-sessions", type: "number_card", col: 3, label: "Active sessions",
            aggregation: { resource: "auth.session", fn: "count",
                filter: { field: "active", op: "eq", value: true } },
            drilldown: "/auth/sessions" },
        { id: "k-tokens", type: "number_card", col: 3, label: "API tokens",
            aggregation: { resource: "auth.api-token", fn: "count",
                filter: { field: "revoked", op: "eq", value: false } },
            drilldown: "/auth/api-tokens" },
        { id: "h2", type: "header", col: 12, label: "Charts", level: 2 },
        { id: "c-role", type: "chart", col: 6, label: "Users by role", chart: "donut",
            aggregation: { resource: "auth.user", fn: "count", groupBy: "role" } },
        { id: "c-provider", type: "chart", col: 6, label: "Sign-ins by provider", chart: "donut",
            aggregation: { resource: "auth.session", fn: "count", groupBy: "provider" } },
        { id: "c-logins", type: "chart", col: 6, label: "Logins (30d)", chart: "area",
            aggregation: { resource: "auth.login-event", fn: "count", period: "day", range: { kind: "last", days: 30 } } },
        { id: "c-failed", type: "chart", col: 6, label: "Failed attempts (30d)", chart: "area",
            aggregation: { resource: "auth.login-event", fn: "count", period: "day",
                filter: { field: "success", op: "eq", value: false },
                range: { kind: "last", days: 30 } } },
        { id: "h3", type: "header", col: 12, label: "Shortcuts", level: 2 },
        { id: "sc-new", type: "shortcut", col: 3, label: "New user", icon: "UserPlus", href: "/auth/users/new" },
        { id: "sc-role", type: "shortcut", col: 3, label: "New role", icon: "ShieldCheck", href: "/auth/roles/new" },
        { id: "sc-token", type: "shortcut", col: 3, label: "New API token", icon: "Key", href: "/auth/api-tokens/new" },
        { id: "sc-reports", type: "shortcut", col: 3, label: "Reports", icon: "BarChart3", href: "/auth/reports" },
        { id: "h4", type: "header", col: 12, label: "Attention", level: 2 },
        { id: "ql-no-mfa", type: "quick_list", col: 6, label: "Users without MFA",
            resource: "auth.user", sort: { field: "lastLogin", dir: "desc" }, limit: 10,
            primary: "name", secondary: "email",
            filter: { field: "mfa", op: "eq", value: false } },
        { id: "ql-inactive", type: "quick_list", col: 6, label: "Inactive >90d",
            resource: "auth.user", sort: { field: "lastLogin", dir: "asc" }, limit: 10,
            primary: "name", secondary: "lastLogin",
            filter: { field: "inactiveOver90d", op: "eq", value: true } },
    ],
};
export const authControlRoomView = buildControlRoom({
    viewId: "auth.control-room.view",
    resource: "auth.user",
    title: "Auth & Security Control Room",
    description: "Identity pulse: users, MFA, sessions, API tokens, sign-ins.",
    workspace,
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const usersByRoleReport = {
    id: "users-by-role", label: "Users by Role",
    description: "Account breakdown by role + MFA enrollment.",
    icon: "Users", resource: "auth.user", filters: [],
    async execute({ resources }) {
        const users = await fetchAll(resources, "auth.user");
        const by = new Map();
        for (const u of users) {
            const r = str(u.role);
            const row = by.get(r) ?? { role: r, total: 0, mfaEnrolled: 0, active: 0 };
            row.total++;
            if (u.mfa)
                row.mfaEnrolled++;
            if (u.status === "active")
                row.active++;
            by.set(r, row);
        }
        const rows = [...by.values()];
        return {
            columns: [
                { field: "role", label: "Role", fieldtype: "enum" },
                { field: "total", label: "Total", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "active", label: "Active", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "mfaEnrolled", label: "MFA enrolled", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
        };
    },
};
const signinHistoryReport = {
    id: "signin-history", label: "Sign-in History",
    description: "Successful + failed sign-ins by IP + user.",
    icon: "LogIn", resource: "auth.login-event", filters: [],
    async execute({ resources }) {
        const events = await fetchAll(resources, "auth.login-event");
        const rows = events
            .slice()
            .sort((a, b) => str(b.occurredAt).localeCompare(str(a.occurredAt)))
            .slice(0, 200)
            .map((e) => ({
            occurredAt: str(e.occurredAt),
            user: str(e.user),
            provider: str(e.provider),
            ip: str(e.ip),
            userAgent: str(e.userAgent),
            success: e.success ? "Yes" : "No",
            reason: str(e.reason),
        }));
        return {
            columns: [
                { field: "occurredAt", label: "When", fieldtype: "datetime" },
                { field: "user", label: "User", fieldtype: "text" },
                { field: "provider", label: "Provider", fieldtype: "enum" },
                { field: "ip", label: "IP", fieldtype: "text" },
                { field: "userAgent", label: "UA", fieldtype: "text" },
                { field: "success", label: "Success", fieldtype: "text" },
                { field: "reason", label: "Reason", fieldtype: "text" },
            ],
            rows,
        };
    },
};
const mfaCoverageReport = {
    id: "mfa-coverage", label: "MFA Coverage",
    description: "MFA enrollment rate per role.",
    icon: "ShieldCheck", resource: "auth.user", filters: [],
    async execute({ resources }) {
        const users = await fetchAll(resources, "auth.user");
        const by = new Map();
        for (const u of users) {
            const r = str(u.role);
            const row = by.get(r) ?? { role: r, total: 0, enrolled: 0, rate: 0 };
            row.total++;
            if (u.mfa)
                row.enrolled++;
            by.set(r, row);
        }
        const rows = [...by.values()]
            .map((r) => ({ ...r, rate: r.total > 0 ? Math.round((r.enrolled / r.total) * 100) : 0 }))
            .sort((a, b) => a.rate - b.rate);
        return {
            columns: [
                { field: "role", label: "Role", fieldtype: "enum" },
                { field: "total", label: "Total", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "enrolled", label: "Enrolled", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "rate", label: "Rate %", fieldtype: "percent", align: "right" },
            ],
            rows,
        };
    },
};
const inactiveUsersReport = {
    id: "inactive-users", label: "Inactive Users",
    description: "Users who haven't signed in for >90 days.",
    icon: "UserX", resource: "auth.user", filters: [],
    async execute({ resources }) {
        const users = await fetchAll(resources, "auth.user");
        const cutoff = Date.now() - 90 * 86_400_000;
        const rows = users
            .filter((u) => u.status === "active" && Date.parse(str(u.lastLogin)) < cutoff)
            .map((u) => ({
            name: str(u.name),
            email: str(u.email),
            role: str(u.role),
            lastLogin: str(u.lastLogin),
            daysInactive: Math.floor((Date.now() - Date.parse(str(u.lastLogin))) / 86_400_000),
        }))
            .sort((a, b) => b.daysInactive - a.daysInactive);
        return {
            columns: [
                { field: "name", label: "Name", fieldtype: "text" },
                { field: "email", label: "Email", fieldtype: "text" },
                { field: "role", label: "Role", fieldtype: "enum" },
                { field: "lastLogin", label: "Last login", fieldtype: "datetime" },
                { field: "daysInactive", label: "Days inactive", fieldtype: "number", align: "right" },
            ],
            rows,
        };
    },
};
const tokensReport = {
    id: "api-tokens", label: "API Tokens",
    description: "Active API tokens + last used.",
    icon: "Key", resource: "auth.api-token", filters: [],
    async execute({ resources }) {
        const tokens = await fetchAll(resources, "auth.api-token");
        const rows = tokens.map((t) => ({
            name: str(t.name),
            owner: str(t.owner),
            scopes: Array.isArray(t.scopes) ? t.scopes.join(", ") : "",
            lastUsedAt: str(t.lastUsedAt),
            createdAt: str(t.createdAt),
            expiresAt: str(t.expiresAt),
            revoked: t.revoked ? "Yes" : "No",
        })).sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
        return {
            columns: [
                { field: "name", label: "Name", fieldtype: "text" },
                { field: "owner", label: "Owner", fieldtype: "text" },
                { field: "scopes", label: "Scopes", fieldtype: "text" },
                { field: "lastUsedAt", label: "Last used", fieldtype: "datetime" },
                { field: "createdAt", label: "Created", fieldtype: "datetime" },
                { field: "expiresAt", label: "Expires", fieldtype: "datetime" },
                { field: "revoked", label: "Revoked", fieldtype: "text" },
            ],
            rows,
        };
    },
};
export const AUTH_REPORTS = [
    usersByRoleReport, signinHistoryReport, mfaCoverageReport, inactiveUsersReport, tokensReport,
];
const { indexView, detailView } = buildReportLibrary({
    indexViewId: "auth.reports.view",
    detailViewId: "auth.reports-detail.view",
    resource: "auth.user",
    title: "Auth Reports",
    description: "Users by role, sign-in history, MFA coverage, inactive users, API tokens.",
    basePath: "/auth/reports",
    reports: AUTH_REPORTS,
});
export const authReportsIndexView = indexView;
export const authReportsDetailView = detailView;
