import { buildControlRoom } from "./_factory/controlRoomHelper";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const workspace = {
    id: "hr-payroll.control-room",
    label: "HR & Payroll Control Room",
    filterBar: [
        { field: "department", label: "Department", kind: "text" },
        { field: "location", label: "Location", kind: "text" },
        {
            field: "status",
            label: "Status",
            kind: "enum",
            appliesTo: ["hr-payroll.employee"],
            options: [
                { value: "active", label: "Active" },
                { value: "onboarding", label: "Onboarding" },
                { value: "on_leave", label: "On leave" },
                { value: "terminated", label: "Terminated" },
            ],
        },
    ],
    widgets: [
        { id: "h1", type: "header", col: 12, label: "People pulse", level: 2 },
        { id: "k-headcount", type: "number_card", col: 3, label: "Headcount",
            aggregation: { resource: "hr-payroll.employee", fn: "count",
                filter: { field: "status", op: "eq", value: "active" } },
            drilldown: "/hr/employees" },
        { id: "k-open-req", type: "number_card", col: 3, label: "Open requisitions",
            aggregation: { resource: "hr-payroll.job-requisition", fn: "count",
                filter: { field: "status", op: "eq", value: "open" } },
            drilldown: "/hr/job-requisitions" },
        { id: "k-leave-pending", type: "number_card", col: 3, label: "Leave pending",
            aggregation: { resource: "hr-payroll.leave-application", fn: "count",
                filter: { field: "status", op: "eq", value: "pending" } },
            drilldown: "/hr/leave-applications", warnAbove: 10 },
        { id: "k-expense-pending", type: "number_card", col: 3, label: "Expenses pending",
            aggregation: { resource: "hr-payroll.expense-claim", fn: "count",
                filter: { field: "status", op: "eq", value: "submitted" } },
            drilldown: "/hr/expense-claims" },
        { id: "h2", type: "header", col: 12, label: "Charts", level: 2 },
        { id: "c-dept", type: "chart", col: 6, label: "Headcount by department", chart: "donut",
            aggregation: { resource: "hr-payroll.employee", fn: "count", groupBy: "department" },
            drilldown: "/hr/employees" },
        { id: "c-hires", type: "chart", col: 6, label: "New hires (12mo)", chart: "area",
            aggregation: { resource: "hr-payroll.employee", fn: "count", period: "month", range: { kind: "last", days: 365 } } },
        { id: "c-gross", type: "chart", col: 6, label: "Gross payroll (12mo)", chart: "line",
            aggregation: { resource: "hr-payroll.payroll", fn: "sum", field: "gross", period: "month", range: { kind: "last", days: 365 } },
            format: "currency" },
        { id: "c-attendance", type: "chart", col: 6, label: "Attendance today", chart: "bar",
            aggregation: { resource: "hr-payroll.attendance", fn: "count", groupBy: "status" } },
        { id: "h3", type: "header", col: 12, label: "Shortcuts", level: 2 },
        { id: "sc-employee", type: "shortcut", col: 3, label: "New employee", icon: "UserPlus", href: "/hr/employees/new" },
        { id: "sc-run", type: "shortcut", col: 3, label: "Run payroll", icon: "Banknote", href: "/hr/payroll/new" },
        { id: "sc-leave", type: "shortcut", col: 3, label: "Apply leave", icon: "Calendar", href: "/hr/leave-applications/new" },
        { id: "sc-reports", type: "shortcut", col: 3, label: "Reports", icon: "BarChart3", href: "/hr/reports" },
        { id: "h4", type: "header", col: 12, label: "Attention", level: 2 },
        { id: "ql-pending-leave", type: "quick_list", col: 6, label: "Leave awaiting approval",
            resource: "hr-payroll.leave-application",
            sort: { field: "submittedAt", dir: "desc" }, limit: 10,
            primary: "employee", secondary: "leaveType",
            filter: { field: "status", op: "eq", value: "pending" },
            href: (r) => `/hr/leave-applications/${r.id}` },
        { id: "ql-expiring-contracts", type: "quick_list", col: 6, label: "Upcoming anniversaries",
            resource: "hr-payroll.employee",
            sort: { field: "anniversaryAt", dir: "asc" }, limit: 10,
            primary: "name", secondary: "anniversaryAt",
            href: (r) => `/hr/employees/${r.id}` },
    ],
};
export const hrPayrollControlRoomView = buildControlRoom({
    viewId: "hr-payroll.control-room.view",
    resource: "hr-payroll.employee",
    title: "HR & Payroll Control Room",
    description: "Headcount, open reqs, leave/expense queues, payroll pulse.",
    workspace,
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const headcountReport = {
    id: "headcount", label: "Headcount",
    description: "Active headcount by department + role.",
    icon: "Users", resource: "hr-payroll.employee", filters: [],
    async execute({ resources }) {
        const emps = await fetchAll(resources, "hr-payroll.employee");
        const by = new Map();
        for (const e of emps) {
            if (str(e.status, "active") !== "active")
                continue;
            const k = `${str(e.department)}|${str(e.role)}`;
            const r = by.get(k) ?? { department: str(e.department), role: str(e.role), count: 0 };
            r.count++;
            by.set(k, r);
        }
        const rows = [...by.values()].sort((a, b) => b.count - a.count);
        return {
            columns: [
                { field: "department", label: "Department", fieldtype: "enum" },
                { field: "role", label: "Role", fieldtype: "text" },
                { field: "count", label: "Count", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
            chart: {
                kind: "bar", label: "Count by department",
                from: (rs) => {
                    const agg = new Map();
                    for (const r of rs)
                        agg.set(r.department, (agg.get(r.department) ?? 0) + r.count);
                    return [...agg.entries()].map(([label, value]) => ({ label, value }));
                },
            },
        };
    },
};
const attendanceSummaryReport = {
    id: "attendance-summary", label: "Attendance Summary",
    description: "Daily status roll-up per employee.",
    icon: "CalendarCheck", resource: "hr-payroll.attendance", filters: [],
    async execute({ resources }) {
        const att = await fetchAll(resources, "hr-payroll.attendance");
        const by = new Map();
        for (const a of att) {
            const emp = str(a.employee);
            const r = by.get(emp) ?? { employee: emp, present: 0, absent: 0, late: 0, leave: 0 };
            const s = str(a.status);
            if (s === "present")
                r.present++;
            else if (s === "absent")
                r.absent++;
            else if (s === "late")
                r.late++;
            else if (s === "leave")
                r.leave++;
            by.set(emp, r);
        }
        const rows = [...by.values()].sort((a, b) => a.employee.localeCompare(b.employee));
        return {
            columns: [
                { field: "employee", label: "Employee", fieldtype: "text" },
                { field: "present", label: "Present", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "absent", label: "Absent", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "late", label: "Late", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "leave", label: "On leave", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
        };
    },
};
const leaveBalanceReport = {
    id: "leave-balance", label: "Leave Balance",
    description: "Accrued vs used leave per employee, per type.",
    icon: "CalendarRange", resource: "hr-payroll.leave-balance", filters: [],
    async execute({ resources }) {
        const bals = await fetchAll(resources, "hr-payroll.leave-balance");
        const rows = bals.map((b) => ({
            employee: str(b.employee),
            leaveType: str(b.leaveType),
            accrued: num(b.accrued),
            used: num(b.used),
            available: num(b.accrued) - num(b.used),
            year: str(b.year),
        })).sort((a, b) => a.employee.localeCompare(b.employee) || a.leaveType.localeCompare(b.leaveType));
        return {
            columns: [
                { field: "employee", label: "Employee", fieldtype: "text" },
                { field: "leaveType", label: "Leave type", fieldtype: "enum" },
                { field: "accrued", label: "Accrued", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "used", label: "Used", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "available", label: "Available", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "year", label: "Year", fieldtype: "text" },
            ],
            rows,
        };
    },
};
const payrollSummaryReport = {
    id: "payroll-summary", label: "Payroll Summary",
    description: "Gross, deductions, net — per period.",
    icon: "Banknote", resource: "hr-payroll.payroll", filters: [],
    async execute({ resources }) {
        const pays = await fetchAll(resources, "hr-payroll.payroll");
        const rows = pays.map((p) => ({
            period: str(p.period),
            employees: num(p.employees),
            gross: num(p.gross),
            deductions: num(p.deductions),
            taxes: num(p.taxes),
            net: num(p.gross) - num(p.deductions) - num(p.taxes),
            status: str(p.status),
        })).sort((a, b) => a.period.localeCompare(b.period));
        return {
            columns: [
                { field: "period", label: "Period", fieldtype: "text" },
                { field: "employees", label: "Employees", fieldtype: "number", align: "right" },
                { field: "gross", label: "Gross", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "deductions", label: "Deductions", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "taxes", label: "Taxes", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "net", label: "Net", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "status", label: "Status", fieldtype: "enum" },
            ],
            rows,
            chart: { kind: "line", label: "Gross payroll trend", format: "currency", currency: "USD",
                from: (rs) => rs.map((r) => ({ label: r.period, value: r.gross })) },
        };
    },
};
const expenseClaimsReport = {
    id: "expense-claims", label: "Expense Claims Summary",
    description: "Claims by status, category, and employee.",
    icon: "Receipt", resource: "hr-payroll.expense-claim", filters: [],
    async execute({ resources }) {
        const claims = await fetchAll(resources, "hr-payroll.expense-claim");
        const by = new Map();
        for (const c of claims) {
            const cat = str(c.category, "uncategorized");
            const r = by.get(cat) ?? { category: cat, submitted: 0, approved: 0, rejected: 0, amount: 0 };
            const s = str(c.status);
            if (s === "submitted")
                r.submitted++;
            else if (s === "approved" || s === "reimbursed")
                r.approved++;
            else if (s === "rejected")
                r.rejected++;
            if (s === "approved" || s === "reimbursed")
                r.amount += num(c.amount);
            by.set(cat, r);
        }
        const rows = [...by.values()].sort((a, b) => b.amount - a.amount);
        return {
            columns: [
                { field: "category", label: "Category", fieldtype: "enum" },
                { field: "submitted", label: "Submitted", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "approved", label: "Approved", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "rejected", label: "Rejected", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "amount", label: "Approved $", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
            chart: { kind: "donut", label: "Approved $ by category", format: "currency", currency: "USD",
                from: (rs) => rs.map((r) => ({ label: r.category, value: r.amount })) },
        };
    },
};
const tenureReport = {
    id: "employee-tenure", label: "Employee Tenure",
    description: "Tenure distribution — bucketed.",
    icon: "Hourglass", resource: "hr-payroll.employee", filters: [],
    async execute({ resources }) {
        const emps = await fetchAll(resources, "hr-payroll.employee");
        const now = Date.now();
        const buckets = [
            { label: "0-1 yr", min: 0, max: 365 },
            { label: "1-3 yr", min: 366, max: 365 * 3 },
            { label: "3-5 yr", min: 365 * 3 + 1, max: 365 * 5 },
            { label: "5-10 yr", min: 365 * 5 + 1, max: 365 * 10 },
            { label: "10+ yr", min: 365 * 10 + 1, max: Infinity },
        ];
        const rows = buckets.map((b) => ({ bucket: b.label, count: 0 }));
        for (const e of emps) {
            if (!e.hiredAt)
                continue;
            const days = Math.floor((now - Date.parse(str(e.hiredAt))) / 86_400_000);
            const idx = buckets.findIndex((b) => days >= b.min && days <= b.max);
            if (idx >= 0)
                rows[idx].count++;
        }
        return {
            columns: [
                { field: "bucket", label: "Bucket", fieldtype: "text" },
                { field: "count", label: "Count", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
            chart: { kind: "bar", label: "Tenure distribution",
                from: (rs) => rs.map((r) => ({ label: r.bucket, value: r.count })) },
        };
    },
};
const anniversariesReport = {
    id: "anniversaries", label: "Anniversaries & Birthdays",
    description: "Upcoming work anniversaries + birthdays (next 60d).",
    icon: "Cake", resource: "hr-payroll.employee", filters: [],
    async execute({ resources }) {
        const emps = await fetchAll(resources, "hr-payroll.employee");
        const now = new Date();
        const horizon = 60 * 86_400_000;
        const rows = [];
        for (const e of emps) {
            const addUpcoming = (raw, kind) => {
                if (!raw)
                    return;
                const d = new Date(str(raw));
                if (Number.isNaN(d.getTime()))
                    return;
                const next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
                if (next.getTime() < now.getTime())
                    next.setFullYear(now.getFullYear() + 1);
                const until = next.getTime() - now.getTime();
                if (until > horizon)
                    return;
                rows.push({
                    name: str(e.name),
                    kind,
                    date: next.toISOString(),
                    daysUntil: Math.ceil(until / 86_400_000),
                    years: kind === "anniversary" ? next.getFullYear() - d.getFullYear() : 0,
                });
            };
            if (e.hiredAt)
                addUpcoming(str(e.hiredAt), "anniversary");
            if (e.birthday)
                addUpcoming(str(e.birthday), "birthday");
        }
        rows.sort((a, b) => a.daysUntil - b.daysUntil);
        return {
            columns: [
                { field: "name", label: "Employee", fieldtype: "text" },
                { field: "kind", label: "Kind", fieldtype: "enum" },
                { field: "date", label: "Date", fieldtype: "date" },
                { field: "daysUntil", label: "Days until", fieldtype: "number", align: "right" },
                { field: "years", label: "Years", fieldtype: "number", align: "right" },
            ],
            rows,
        };
    },
};
const salarySlipReport = {
    id: "salary-slip", label: "Salary Slip",
    description: "Per-employee payslips — earnings, deductions, net.",
    icon: "FileText", resource: "hr-payroll.salary-slip", filters: [],
    async execute({ resources }) {
        const slips = await fetchAll(resources, "hr-payroll.salary-slip");
        const rows = slips.map((s) => ({
            period: str(s.period),
            employee: str(s.employee),
            basic: num(s.basic),
            hra: num(s.hra),
            allowances: num(s.allowances),
            gross: num(s.basic) + num(s.hra) + num(s.allowances),
            pf: num(s.pf),
            tax: num(s.tax),
            other: num(s.otherDeductions),
            net: num(s.net),
            status: str(s.status),
        })).sort((a, b) => a.period.localeCompare(b.period) || a.employee.localeCompare(b.employee));
        return {
            columns: [
                { field: "period", label: "Period", fieldtype: "text" },
                { field: "employee", label: "Employee", fieldtype: "text" },
                { field: "basic", label: "Basic", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "hra", label: "HRA", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "allowances", label: "Allowances", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "gross", label: "Gross", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "pf", label: "PF", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "tax", label: "Tax", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "other", label: "Other ded.", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "net", label: "Net pay", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "status", label: "Status", fieldtype: "enum" },
            ],
            rows,
        };
    },
};
const newHiresReport = {
    id: "new-hires", label: "New Hires (Monthly)",
    description: "New hires per month, trailing 12mo.",
    icon: "UserPlus", resource: "hr-payroll.employee", filters: [],
    async execute({ resources }) {
        const emps = await fetchAll(resources, "hr-payroll.employee");
        const now = Date.now();
        const cutoff = now - 365 * 86_400_000;
        const by = new Map();
        for (const e of emps) {
            if (!e.hiredAt)
                continue;
            const t = Date.parse(str(e.hiredAt));
            if (Number.isNaN(t) || t < cutoff)
                continue;
            const k = monthKey(new Date(t));
            const r = by.get(k) ?? { month: k, hires: 0 };
            r.hires++;
            by.set(k, r);
        }
        const rows = [...by.values()].sort((a, b) => a.month.localeCompare(b.month));
        return {
            columns: [
                { field: "month", label: "Month", fieldtype: "text" },
                { field: "hires", label: "Hires", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
            chart: { kind: "line", label: "New hires / month",
                from: (rs) => rs.map((r) => ({ label: r.month, value: r.hires })) },
        };
    },
};
export const HR_PAYROLL_REPORTS = [
    headcountReport,
    attendanceSummaryReport,
    leaveBalanceReport,
    payrollSummaryReport,
    expenseClaimsReport,
    tenureReport,
    anniversariesReport,
    salarySlipReport,
    newHiresReport,
];
const { indexView, detailView } = buildReportLibrary({
    indexViewId: "hr-payroll.reports.view",
    detailViewId: "hr-payroll.reports-detail.view",
    resource: "hr-payroll.employee",
    title: "HR & Payroll Reports",
    description: "Headcount, attendance, leave balances, payroll, expenses, tenure, anniversaries, salary slips.",
    basePath: "/hr/reports",
    reports: HR_PAYROLL_REPORTS,
});
export const hrPayrollReportsIndexView = indexView;
export const hrPayrollReportsDetailView = detailView;
