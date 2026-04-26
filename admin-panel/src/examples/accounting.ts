import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_LIFECYCLE, CURRENCY, STATUS_ACTIVE } from "./_factory/options";
import { COMPANIES, code, daysAgo, daysFromNow, money, pick } from "./_factory/seeds";
import { accountingCloseView } from "./accounting-pages";
import {
  accountingControlRoomView,
  accountingReportsIndexView,
  accountingReportsDetailView,
} from "./accounting-dashboard";
import {
  accountingArchetypeDashboardView,
  accountingArchetypeNav,
} from "./accounting-archetype";

const DEPARTMENTS = ["Engineering", "Sales", "Marketing", "Operations", "Finance", "Support", "HR"];
const BANKS = ["Chase", "HSBC", "Barclays", "Wise", "Mercury"];
const OWNERS = ["sam@gutu.dev", "alex@gutu.dev", "taylor@gutu.dev", "jordan@gutu.dev"];

export const accountingPlugin = buildDomainPlugin({
  id: "accounting",
  label: "Accounting",
  icon: "Receipt",
  section: SECTIONS.finance,
  order: 1,
  resources: [
    {
      id: "invoice",
      singular: "Invoice",
      plural: "Invoices",
      icon: "FileText",
      path: "/accounting/invoices",
      displayField: "number",
      pageSize: 12,
      defaultSort: { field: "issuedAt", dir: "desc" },
      erp: {
        documentType: "accounts.Sales Invoice",
        module: "Accounts",
        namingSeries: "SINV-.YYYY.-.#####",
        statusField: "status",
        submittedStatuses: ["approved", "published"],
        titleField: "number",
        childTables: [
          {
            field: "items",
            label: "Items",
            itemField: "item",
            quantityField: "quantity",
            amountField: "amount",
            fields: [
              { name: "item", label: "Item", kind: "link", referenceTo: "inventory.item", required: true },
              { name: "description", kind: "text" },
              { name: "quantity", kind: "number", required: true },
              { name: "rate", kind: "currency", required: true },
              { name: "amount", kind: "currency", readonly: true }
            ]
          },
          {
            field: "taxes",
            label: "Taxes",
            amountField: "taxAmount",
            fields: [
              { name: "account", kind: "link", referenceTo: "accounting.account", required: true },
              { name: "rate", kind: "number" },
              { name: "taxAmount", kind: "currency", readonly: true }
            ]
          },
          {
            field: "payments",
            label: "Payments",
            amountField: "allocatedAmount",
            fields: [
              { name: "paymentEntry", kind: "link", referenceTo: "accounting.payment-entry" },
              { name: "allocatedAmount", kind: "currency" }
            ]
          }
        ],
        mappingActions: [
          {
            id: "invoice-to-payment",
            label: "Create Payment",
            relation: "settled-by",
            targetResourceId: "accounting.payment-entry",
            targetDocumentType: "accounts.Payment Entry",
            visibleInStatuses: ["approved", "published"],
            fieldMap: { party: "customer", amount: "amount", currency: "currency", referenceNo: "number" },
            defaults: { status: "draft", paymentType: "Receive" }
          },
          {
            id: "invoice-to-credit-note",
            label: "Create Credit Note",
            relation: "reversed-by",
            targetResourceId: "accounting.invoice",
            targetDocumentType: "accounts.Sales Invoice",
            visibleInStatuses: ["approved", "published"],
            fieldMap: { customer: "customer", amount: "amount", currency: "currency" },
            childTableMap: { items: "items", taxes: "taxes" },
            defaults: { status: "draft", isReturn: true }
          }
        ],
        links: [
          { field: "customer", targetResourceId: "party.entity", reverseRelation: "invoices" },
          { field: "salesOrder", targetResourceId: "sales.order", reverseRelation: "invoices" }
        ],
        printFormats: [{ id: "standard-tax-invoice", label: "Standard Tax Invoice", default: true, paperSize: "A4" }],
        portal: { route: "/invoices/:id", audience: "customer", enabledByDefault: true },
        workspaceLinks: [
          { label: "General Ledger", path: "/accounting/reports/general-ledger", kind: "report", group: "Ledger" },
          { label: "Accounts Receivable", path: "/accounting/reports/accounts-receivable", kind: "report", group: "Receivables" },
          { label: "Payment Entries", path: "/accounting/payment-entries", kind: "document", group: "Receivables" }
        ]
      },
      fields: [
        { name: "number", label: "Number", kind: "text", required: true, sortable: true, width: 130 },
        { name: "customer", label: "Customer", kind: "text", required: true, sortable: true },
        { name: "status", label: "Status", kind: "enum", required: true, options: STATUS_LIFECYCLE, sortable: true, width: 120 },
        { name: "issuedAt", label: "Issued", kind: "date", required: true, sortable: true, width: 130 },
        { name: "dueAt", label: "Due", kind: "date", sortable: true, width: 130 },
        { name: "amount", label: "Amount", kind: "currency", required: true, align: "right", sortable: true, width: 120 },
        { name: "currency", label: "Currency", kind: "enum", options: CURRENCY, width: 100 },
        { name: "notes", kind: "textarea", formSection: "Notes" },
      ],
      seedCount: 24,
      seed: (i) => ({
        number: code("INV", i),
        customer: pick(COMPANIES, i),
        status: pick(["draft", "pending", "approved", "published", "archived"], i),
        issuedAt: daysAgo(i * 3),
        dueAt: daysAgo(i * 3 - 30),
        amount: money(i, 200, 20000),
        currency: pick(["USD", "EUR", "GBP"], i),
        notes: i % 4 === 0 ? "Net 30" : "",
      }),
    },
    {
      id: "bill",
      singular: "Bill",
      plural: "Bills",
      icon: "FileMinus",
      path: "/accounting/bills",
      displayField: "number",
      erp: {
        documentType: "accounts.Purchase Invoice",
        module: "Accounts",
        namingSeries: "PINV-.YYYY.-.#####",
        statusField: "status",
        submittedStatuses: ["approved", "published"],
        childTables: [
          {
            field: "items",
            label: "Items",
            itemField: "item",
            quantityField: "quantity",
            amountField: "amount",
            fields: [
              { name: "item", kind: "link", referenceTo: "inventory.item", required: true },
              { name: "quantity", kind: "number", required: true },
              { name: "rate", kind: "currency", required: true },
              { name: "amount", kind: "currency", readonly: true }
            ]
          }
        ],
        mappingActions: [
          {
            id: "bill-to-payment",
            label: "Create Payment",
            relation: "settled-by",
            targetResourceId: "accounting.payment-entry",
            targetDocumentType: "accounts.Payment Entry",
            visibleInStatuses: ["approved", "published"],
            fieldMap: { party: "vendor", amount: "amount", currency: "currency", referenceNo: "number" },
            defaults: { status: "draft", paymentType: "Pay" }
          }
        ],
        links: [{ field: "vendor", targetResourceId: "party.entity", reverseRelation: "bills" }],
        printFormats: [{ id: "standard-purchase-invoice", label: "Standard Purchase Invoice", default: true }],
        portal: { route: "/supplier-invoices/:id", audience: "supplier", enabledByDefault: true }
      },
      fields: [
        { name: "number", label: "Number", kind: "text", required: true, sortable: true },
        { name: "vendor", label: "Vendor", kind: "text", required: true, sortable: true },
        { name: "status", kind: "enum", required: true, options: STATUS_LIFECYCLE, sortable: true },
        { name: "dueAt", label: "Due", kind: "date", sortable: true },
        { name: "amount", kind: "currency", required: true, align: "right", sortable: true },
      ],
      seedCount: 18,
      seed: (i) => ({
        number: code("BILL", i),
        vendor: pick(COMPANIES, i + 2),
        status: pick(["pending", "approved", "published"], i),
        dueAt: daysAgo(i * 2 - 15),
        amount: money(i, 100, 8000),
      }),
    },
    {
      id: "account",
      singular: "Account",
      plural: "Chart of Accounts",
      icon: "BookOpen",
      path: "/accounting/accounts",
      erp: {
        documentType: "accounts.Account",
        module: "Accounts",
        titleField: "name",
        links: [{ field: "parentId", targetResourceId: "accounting.account", reverseRelation: "children" }],
        workspaceLinks: [
          { label: "Chart of Accounts", path: "/accounting/accounts", kind: "document", group: "Setup" },
          { label: "Trial Balance", path: "/accounting/reports/trial-balance", kind: "report", group: "Statements" }
        ]
      },
      fields: [
        { name: "code", kind: "text", required: true, sortable: true, width: 100 },
        { name: "name", kind: "text", required: true, sortable: true },
        {
          name: "type",
          kind: "enum",
          required: true,
          options: [
            { value: "asset", label: "Asset" },
            { value: "liability", label: "Liability" },
            { value: "equity", label: "Equity" },
            { value: "revenue", label: "Revenue" },
            { value: "expense", label: "Expense" },
          ],
          sortable: true,
        },
        { name: "balance", kind: "currency", align: "right", sortable: true },
      ],
      seedCount: 20,
      seed: (i) => ({
        code: String(1000 + i * 10),
        name: pick(
          ["Cash", "Accounts Receivable", "Inventory", "Accounts Payable", "Sales Revenue", "COGS", "Rent", "Utilities"],
          i,
        ),
        type: pick(["asset", "liability", "revenue", "expense"], i),
        balance: money(i, 500, 50000),
      }),
    },
    {
      id: "journal-entry",
      singular: "Journal Entry",
      plural: "Journal Entries",
      icon: "NotebookPen",
      path: "/accounting/journal-entries",
      displayField: "number",
      defaultSort: { field: "postedAt", dir: "desc" },
      erp: {
        documentType: "accounts.Journal Entry",
        module: "Accounts",
        namingSeries: "ACC-JV-.YYYY.-.#####",
        statusField: "status",
        submittedStatuses: ["posted"],
        childTables: [
          {
            field: "accounts",
            label: "Accounting Entries",
            amountField: "debit",
            fields: [
              { name: "account", kind: "link", referenceTo: "accounting.account", required: true },
              { name: "party", kind: "link", referenceTo: "party.entity" },
              { name: "costCenter", kind: "link", referenceTo: "accounting.cost-center" },
              { name: "debit", kind: "currency" },
              { name: "credit", kind: "currency" }
            ]
          }
        ],
        mappingActions: [
          {
            id: "journal-reverse",
            label: "Reverse Journal",
            relation: "reversed-by",
            targetResourceId: "accounting.journal-entry",
            targetDocumentType: "accounts.Journal Entry",
            visibleInStatuses: ["posted"],
            childTableMap: { lines: "lines" },
            defaults: { status: "draft", reversal: true }
          }
        ],
        printFormats: [{ id: "journal-voucher", label: "Journal Voucher", default: true }]
      },
      fields: [
        { name: "number", label: "Number", kind: "text", required: true, sortable: true, width: 130 },
        { name: "postedAt", label: "Posted", kind: "date", required: true, sortable: true, width: 130 },
        { name: "reference", label: "Reference", kind: "text", width: 140 },
        { name: "memo", label: "Memo", kind: "text" },
        {
          name: "status",
          label: "Status",
          kind: "enum",
          required: true,
          sortable: true,
          options: [
            { value: "draft", label: "Draft", intent: "neutral" },
            { value: "posted", label: "Posted", intent: "success" },
            { value: "reversed", label: "Reversed", intent: "warning" },
          ],
          width: 110,
        },
        { name: "debitTotal", label: "Debit", kind: "currency", align: "right", sortable: true },
        { name: "creditTotal", label: "Credit", kind: "currency", align: "right", sortable: true },
        { name: "currency", label: "Currency", kind: "enum", options: CURRENCY, width: 100 },
        { name: "createdBy", label: "Created by", kind: "text", width: 150 },
        { name: "notes", label: "Notes", kind: "textarea", formSection: "Notes" },
      ],
      seedCount: 30,
      seed: (i) => {
        const total = money(i, 500, 30000);
        return {
          number: code("JE", i, 5),
          postedAt: daysAgo(i),
          reference: pick(["AR", "AP", "PAY", "ADJ", "ACC"], i) + "-" + (100 + i),
          memo: pick(
            [
              "Monthly accrual",
              "Bank reconciliation",
              "FX revaluation",
              "Payroll posting",
              "Deferred revenue release",
              "Depreciation",
              "Intercompany transfer",
            ],
            i,
          ),
          status: pick(["posted", "posted", "posted", "draft", "reversed"], i),
          debitTotal: total,
          creditTotal: total,
          currency: pick(["USD", "EUR", "GBP"], i),
          createdBy: pick(OWNERS, i),
          notes: i % 5 === 0 ? "Reviewed and approved by Finance." : "",
        };
      },
    },
    {
      id: "payment-entry",
      singular: "Payment Entry",
      plural: "Payment Entries",
      icon: "CreditCard",
      path: "/accounting/payment-entries",
      displayField: "reference",
      defaultSort: { field: "postedAt", dir: "desc" },
      erp: {
        documentType: "accounts.Payment Entry",
        module: "Accounts",
        namingSeries: "ACC-PAY-.YYYY.-.#####",
        statusField: "status",
        submittedStatuses: ["cleared"],
        childTables: [
          {
            field: "references",
            label: "Reference Allocations",
            amountField: "allocatedAmount",
            fields: [
              { name: "referenceType", kind: "text" },
              { name: "referenceName", kind: "dynamic-link", dynamicReferenceField: "referenceType" },
              { name: "outstandingAmount", kind: "currency", readonly: true },
              { name: "allocatedAmount", kind: "currency" }
            ]
          }
        ],
        links: [
          { field: "party", targetResourceId: "party.entity", reverseRelation: "payments" },
          { field: "bankAccount", targetResourceId: "accounting.bank-account", reverseRelation: "payments" }
        ],
        printFormats: [{ id: "payment-receipt", label: "Payment Receipt", default: true }]
      },
      fields: [
        { name: "reference", label: "Reference", kind: "text", required: true, sortable: true, width: 140 },
        {
          name: "direction",
          label: "Direction",
          kind: "enum",
          required: true,
          sortable: true,
          options: [
            { value: "receive", label: "Receive", intent: "success" },
            { value: "pay", label: "Pay", intent: "danger" },
          ],
          width: 110,
        },
        { name: "party", label: "Party", kind: "text", required: true, sortable: true },
        { name: "amount", label: "Amount", kind: "currency", required: true, align: "right", sortable: true },
        { name: "currency", label: "Currency", kind: "enum", options: CURRENCY, width: 100 },
        {
          name: "method",
          label: "Method",
          kind: "enum",
          options: [
            { value: "ach", label: "ACH" },
            { value: "wire", label: "Wire" },
            { value: "card", label: "Card" },
            { value: "cash", label: "Cash" },
            { value: "check", label: "Check" },
          ],
          width: 100,
        },
        { name: "postedAt", label: "Posted", kind: "date", required: true, sortable: true, width: 130 },
        { name: "bankAccount", label: "Bank Account", kind: "text", width: 160 },
        {
          name: "status",
          label: "Status",
          kind: "enum",
          required: true,
          sortable: true,
          options: [
            { value: "pending", label: "Pending", intent: "warning" },
            { value: "cleared", label: "Cleared", intent: "success" },
            { value: "failed", label: "Failed", intent: "danger" },
            { value: "reconciled", label: "Reconciled", intent: "info" },
          ],
          width: 120,
        },
        { name: "invoiceId", label: "Invoice", kind: "text", width: 130 },
        { name: "notes", label: "Notes", kind: "textarea", formSection: "Notes" },
      ],
      seedCount: 40,
      seed: (i) => ({
        reference: code("PE", i, 6),
        direction: i % 3 === 0 ? "pay" : "receive",
        party: pick(COMPANIES, i),
        amount: money(i, 100, 15000),
        currency: pick(["USD", "EUR", "GBP"], i),
        method: pick(["ach", "wire", "card", "check", "cash"], i),
        postedAt: daysAgo(i * 0.8),
        bankAccount: pick(["Ops USD", "Reserve EUR", "Payroll USD", "Operating GBP"], i),
        status: pick(["cleared", "cleared", "cleared", "pending", "reconciled", "failed"], i),
        invoiceId: i % 3 === 0 ? code("INV", i, 4) : "",
        notes: "",
      }),
    },
    {
      id: "bank-account",
      singular: "Bank Account",
      plural: "Bank Accounts",
      icon: "Landmark",
      path: "/accounting/bank-accounts",
      fields: [
        { name: "name", label: "Name", kind: "text", required: true, sortable: true },
        { name: "bank", label: "Bank", kind: "text", required: true, sortable: true },
        { name: "accountNumber", label: "Account #", kind: "text" },
        { name: "iban", label: "IBAN", kind: "text" },
        { name: "swift", label: "SWIFT/BIC", kind: "text" },
        { name: "currency", label: "Currency", kind: "enum", required: true, options: CURRENCY, width: 100 },
        { name: "balance", label: "Balance", kind: "currency", align: "right", sortable: true },
        { name: "openingBalance", label: "Opening", kind: "currency", align: "right" },
        {
          name: "status",
          label: "Status",
          kind: "enum",
          options: STATUS_ACTIVE,
          sortable: true,
        },
      ],
      seedCount: 8,
      seed: (i) => ({
        name: pick(["Ops USD", "Reserve EUR", "Payroll USD", "Operating GBP", "Tax USD", "Rainy-day EUR", "M&A USD", "Petty Cash"], i),
        bank: pick(BANKS, i),
        accountNumber: `****${1000 + i * 137}`,
        iban: `GB${String(10 + i).padStart(2, "0")}CHAS${String(60161331268500 + i * 7).slice(-14)}`,
        swift: pick(["CHASUS33", "MIDLGB22", "BARCGB22", "TRWIUS35"], i),
        currency: pick(["USD", "EUR", "GBP"], i),
        balance: money(i, 10_000, 500_000),
        openingBalance: money(i + 2, 10_000, 400_000),
        status: i === 7 ? "archived" : "active",
      }),
    },
    {
      id: "bank-transaction",
      singular: "Bank Transaction",
      plural: "Bank Transactions",
      icon: "ArrowLeftRight",
      path: "/accounting/bank-transactions",
      displayField: "description",
      defaultSort: { field: "occurredAt", dir: "desc" },
      fields: [
        { name: "occurredAt", label: "Date", kind: "date", required: true, sortable: true, width: 130 },
        { name: "description", label: "Description", kind: "text", required: true, sortable: true },
        { name: "bankAccount", label: "Bank Account", kind: "text", required: true, sortable: true, width: 160 },
        {
          name: "direction",
          label: "Direction",
          kind: "enum",
          required: true,
          options: [
            { value: "credit", label: "Credit", intent: "success" },
            { value: "debit", label: "Debit", intent: "danger" },
          ],
          width: 100,
        },
        { name: "amount", label: "Amount", kind: "currency", required: true, align: "right", sortable: true },
        { name: "currency", label: "Currency", kind: "enum", options: CURRENCY, width: 100 },
        { name: "reference", label: "Reference", kind: "text" },
        {
          name: "reconciled",
          label: "Reconciled",
          kind: "boolean",
          sortable: true,
          width: 110,
        },
        {
          name: "matchedInvoiceId",
          label: "Matched invoice",
          kind: "text",
          width: 140,
        },
      ],
      seedCount: 60,
      seed: (i) => ({
        occurredAt: daysAgo(i * 0.4),
        description: pick(
          [
            "Wire transfer — invoice payment",
            "ACH debit — vendor",
            "Card fee",
            "Payroll run",
            "Interest credit",
            "FX margin adjustment",
            "Bank wire fee",
            "Tax deposit",
            "Customer refund",
          ],
          i,
        ),
        bankAccount: pick(["Ops USD", "Reserve EUR", "Payroll USD", "Operating GBP"], i),
        direction: i % 3 === 0 ? "debit" : "credit",
        amount: money(i, 50, 25_000),
        currency: pick(["USD", "EUR", "GBP"], i),
        reference: code("BT", i, 6),
        reconciled: i % 3 !== 0,
        matchedInvoiceId: i % 5 === 0 ? code("INV", i, 4) : "",
      }),
    },
    {
      id: "budget",
      singular: "Budget",
      plural: "Budgets",
      icon: "Gauge",
      path: "/accounting/budgets",
      displayField: "department",
      defaultSort: { field: "variancePct", dir: "asc" },
      fields: [
        { name: "department", label: "Department", kind: "enum", required: true, sortable: true, options: DEPARTMENTS.map((d) => ({ value: d, label: d })) },
        { name: "period", label: "Period", kind: "text", required: true, sortable: true, width: 120 },
        { name: "costCenter", label: "Cost Center", kind: "text", width: 140 },
        { name: "category", label: "Category", kind: "enum", options: [
          { value: "opex", label: "OpEx" },
          { value: "capex", label: "CapEx" },
          { value: "headcount", label: "Headcount" },
          { value: "marketing", label: "Marketing" },
          { value: "travel", label: "Travel" },
        ]},
        { name: "budget", label: "Budget", kind: "currency", required: true, align: "right", sortable: true },
        { name: "actual", label: "Actual", kind: "currency", required: true, align: "right", sortable: true },
        { name: "variancePct", label: "Var %", kind: "number", align: "right", sortable: true, width: 90 },
        { name: "owner", label: "Owner", kind: "text", width: 150 },
        { name: "notes", label: "Notes", kind: "textarea", formSection: "Notes" },
      ],
      seedCount: 28,
      seed: (i) => {
        const periods = ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4", "2026", "FY2025"];
        const budget = 50_000 + ((i * 12_337) % 450_000);
        const actual = Math.round(budget * (0.7 + ((i * 0.037) % 0.5)));
        const variancePct = budget > 0 ? Math.round(((budget - actual) / budget) * 100) : 0;
        return {
          department: pick(DEPARTMENTS, i),
          period: pick(periods, i),
          costCenter: `CC-${1000 + i * 5}`,
          category: pick(["opex", "capex", "headcount", "marketing", "travel"], i),
          budget,
          actual,
          variancePct,
          owner: pick(OWNERS, i),
          notes: "",
        };
      },
    },
    {
      id: "cost-center",
      singular: "Cost Center",
      plural: "Cost Centers",
      icon: "GitBranch",
      path: "/accounting/cost-centers",
      displayField: "name",
      fields: [
        { name: "code", label: "Code", kind: "text", required: true, sortable: true, width: 100 },
        { name: "name", label: "Name", kind: "text", required: true, sortable: true },
        { name: "parent", label: "Parent", kind: "text" },
        { name: "manager", label: "Manager", kind: "text" },
        { name: "department", label: "Department", kind: "enum", options: DEPARTMENTS.map((d) => ({ value: d, label: d })) },
        {
          name: "status",
          label: "Status",
          kind: "enum",
          options: STATUS_ACTIVE,
        },
      ],
      seedCount: 14,
      seed: (i) => ({
        code: `CC-${1000 + i * 5}`,
        name: pick(
          ["Corporate", "R&D", "GTM", "Support Ops", "Infra", "People", "Exec", "Shared Services", "Field Sales", "Inside Sales", "Partner Alliance", "Product Marketing", "Demand Gen", "Content"],
          i,
        ),
        parent: i > 2 ? `CC-${1000 + ((i - 3) % 3) * 5}` : "",
        manager: pick(OWNERS, i),
        department: pick(DEPARTMENTS, i),
        status: i === 13 ? "archived" : "active",
      }),
    },
    {
      id: "accounting-period",
      singular: "Accounting Period",
      plural: "Accounting Periods",
      icon: "CalendarRange",
      path: "/accounting/periods",
      displayField: "name",
      defaultSort: { field: "startAt", dir: "desc" },
      fields: [
        { name: "name", label: "Name", kind: "text", required: true, sortable: true },
        { name: "startAt", label: "Start", kind: "date", required: true, sortable: true, width: 130 },
        { name: "endAt", label: "End", kind: "date", required: true, sortable: true, width: 130 },
        {
          name: "status",
          label: "Status",
          kind: "enum",
          required: true,
          sortable: true,
          options: [
            { value: "open", label: "Open", intent: "success" },
            { value: "closing", label: "Closing", intent: "warning" },
            { value: "closed", label: "Closed", intent: "neutral" },
            { value: "locked", label: "Locked", intent: "info" },
          ],
        },
        { name: "fiscalYear", label: "Fiscal Year", kind: "text", sortable: true },
        { name: "closedBy", label: "Closed by", kind: "text" },
        { name: "closedAt", label: "Closed at", kind: "date" },
      ],
      seedCount: 12,
      seed: (i) => {
        const monthIdx = 11 - i;
        const y = monthIdx < 0 ? 2025 : 2026;
        const m = ((monthIdx + 12) % 12) + 1;
        const start = new Date(Date.UTC(y, m - 1, 1));
        const end = new Date(Date.UTC(y, m, 0));
        return {
          name: `${y}-${String(m).padStart(2, "0")}`,
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          status: i < 2 ? "open" : i < 3 ? "closing" : i < 9 ? "closed" : "locked",
          fiscalYear: `FY${y}`,
          closedBy: i >= 2 ? pick(OWNERS, i) : "",
          closedAt: i >= 2 ? daysAgo(i * 30) : "",
        };
      },
    },
    {
      id: "tax-rule",
      singular: "Tax Rule",
      plural: "Tax Rules",
      icon: "Scale",
      path: "/accounting/tax-rules",
      displayField: "name",
      fields: [
        { name: "name", label: "Name", kind: "text", required: true, sortable: true },
        { name: "rate", label: "Rate %", kind: "number", required: true, sortable: true, align: "right", width: 110 },
        { name: "jurisdiction", label: "Jurisdiction", kind: "text", sortable: true, width: 140 },
        {
          name: "category",
          label: "Category",
          kind: "enum",
          options: [
            { value: "sales", label: "Sales Tax" },
            { value: "vat", label: "VAT" },
            { value: "gst", label: "GST" },
            { value: "income", label: "Income" },
            { value: "payroll", label: "Payroll" },
            { value: "excise", label: "Excise" },
          ],
          sortable: true,
          width: 120,
        },
        { name: "accountCode", label: "Tax Account", kind: "text", width: 130 },
        { name: "validFrom", label: "Valid from", kind: "date", width: 130 },
        { name: "validTo", label: "Valid to", kind: "date", width: 130 },
        { name: "active", label: "Active", kind: "boolean", sortable: true, width: 90 },
        { name: "notes", label: "Notes", kind: "textarea", formSection: "Notes" },
      ],
      seedCount: 12,
      seed: (i) => ({
        name: pick(
          [
            "US Sales Tax — CA",
            "US Sales Tax — NY",
            "EU VAT — DE",
            "EU VAT — FR",
            "UK VAT standard",
            "IN GST 18%",
            "CA GST 5%",
            "AU GST 10%",
            "JP Consumption 10%",
            "US Payroll Federal",
            "US Payroll State",
            "Customs Excise",
          ],
          i,
        ),
        rate: pick([8.25, 8.875, 19, 20, 20, 18, 5, 10, 10, 6.2, 4.5, 12], i),
        jurisdiction: pick(["US-CA", "US-NY", "EU-DE", "EU-FR", "UK", "IN", "CA", "AU", "JP", "US-FED", "US-STATE", "INTL"], i),
        category: pick(["sales", "sales", "vat", "vat", "vat", "gst", "gst", "gst", "gst", "payroll", "payroll", "excise"], i),
        accountCode: pick(["2200", "2210", "2300", "2310", "2320", "2400", "2410", "2420"], i),
        validFrom: daysAgo(365),
        validTo: daysFromNow(365),
        active: i !== 11,
        notes: "",
      }),
    },
    {
      id: "dunning",
      singular: "Dunning Level",
      plural: "Dunning Levels",
      icon: "AlertTriangle",
      path: "/accounting/dunning",
      displayField: "name",
      defaultSort: { field: "daysOverdue", dir: "asc" },
      fields: [
        { name: "name", label: "Name", kind: "text", required: true, sortable: true },
        { name: "level", label: "Level", kind: "number", required: true, align: "right", sortable: true, width: 90 },
        { name: "daysOverdue", label: "Days overdue", kind: "number", required: true, align: "right", sortable: true, width: 130 },
        { name: "feePct", label: "Fee %", kind: "number", align: "right", width: 90 },
        { name: "feeFlat", label: "Flat fee", kind: "currency", align: "right", width: 110 },
        {
          name: "action",
          label: "Action",
          kind: "enum",
          required: true,
          options: [
            { value: "reminder", label: "Reminder email" },
            { value: "warning", label: "Formal warning" },
            { value: "suspend", label: "Suspend service" },
            { value: "legal", label: "Legal action" },
          ],
          width: 160,
        },
        { name: "templateId", label: "Template", kind: "text", width: 160 },
        { name: "active", label: "Active", kind: "boolean", width: 90 },
      ],
      seedCount: 5,
      seed: (i) => ({
        name: pick(["Friendly reminder", "First reminder", "Second reminder", "Final notice", "Legal action"], i),
        level: i + 1,
        daysOverdue: pick([3, 15, 30, 60, 90], i),
        feePct: pick([0, 0, 1.5, 3, 5], i),
        feeFlat: pick([0, 0, 0, 25, 50], i),
        action: pick(["reminder", "reminder", "warning", "suspend", "legal"], i),
        templateId: `tpl_dunn_${i + 1}`,
        active: true,
      }),
    },
    {
      id: "fiscal-year",
      singular: "Fiscal Year",
      plural: "Fiscal Years",
      icon: "CalendarCheck",
      path: "/accounting/fiscal-years",
      displayField: "name",
      defaultSort: { field: "startAt", dir: "desc" },
      fields: [
        { name: "name", label: "Name", kind: "text", required: true, sortable: true },
        { name: "startAt", label: "Start", kind: "date", required: true, sortable: true, width: 130 },
        { name: "endAt", label: "End", kind: "date", required: true, sortable: true, width: 130 },
        {
          name: "status",
          label: "Status",
          kind: "enum",
          required: true,
          options: [
            { value: "open", label: "Open", intent: "success" },
            { value: "closed", label: "Closed", intent: "neutral" },
            { value: "current", label: "Current", intent: "info" },
          ],
          sortable: true,
        },
        { name: "company", label: "Company", kind: "text" },
      ],
      seedCount: 5,
      seed: (i) => {
        const y = 2022 + i;
        return {
          name: `FY${y}`,
          startAt: new Date(Date.UTC(y, 0, 1)).toISOString(),
          endAt: new Date(Date.UTC(y, 11, 31)).toISOString(),
          status: y < 2026 ? "closed" : y === 2026 ? "current" : "open",
          company: "Gutu Framework, Inc.",
        };
      },
    },
    {
      id: "currency-rate",
      singular: "Currency Rate",
      plural: "Currency Rates",
      icon: "RefreshCw",
      path: "/accounting/currency-rates",
      displayField: "pair",
      defaultSort: { field: "asOfAt", dir: "desc" },
      fields: [
        { name: "pair", label: "Pair", kind: "text", required: true, sortable: true, width: 110 },
        { name: "from", label: "From", kind: "enum", required: true, options: CURRENCY, width: 90 },
        { name: "to", label: "To", kind: "enum", required: true, options: CURRENCY, width: 90 },
        { name: "rate", label: "Rate", kind: "number", required: true, align: "right", sortable: true, width: 110 },
        { name: "asOfAt", label: "As of", kind: "date", required: true, sortable: true, width: 130 },
        { name: "source", label: "Source", kind: "text", width: 140 },
      ],
      seedCount: 24,
      seed: (i) => {
        const pairs = [
          ["USD", "EUR", 0.93], ["USD", "GBP", 0.79], ["USD", "INR", 83.2],
          ["EUR", "USD", 1.07], ["EUR", "GBP", 0.85], ["GBP", "USD", 1.27],
          ["GBP", "EUR", 1.17], ["INR", "USD", 0.012],
        ] as const;
        const p = pairs[i % pairs.length];
        return {
          pair: `${p[0]}/${p[1]}`,
          from: p[0],
          to: p[1],
          rate: Math.round((p[2] + (((i * 0.0037) % 0.04) - 0.02)) * 10_000) / 10_000,
          asOfAt: daysAgo(Math.floor(i / pairs.length)),
          source: pick(["ECB", "FX Rates API", "Manual"], i),
        };
      },
    },
  ],
  extraNav: [
    accountingArchetypeNav,
    {
      id: "accounting.control-room.nav",
      label: "Accounting Control Room",
      icon: "LayoutDashboard",
      path: "/accounting/control-room",
      view: "accounting.control-room.view",
      order: 0,
    },
    {
      id: "accounting.reports.nav",
      label: "Reports",
      icon: "BarChart3",
      path: "/accounting/reports",
      view: "accounting.reports.view",
    },
    {
      id: "accounting.close.nav",
      label: "Month-end close",
      icon: "CalendarCheck",
      path: "/accounting/close",
      view: "accounting.close.view",
    },
  ],
  extraViews: [
    accountingArchetypeDashboardView,
    accountingControlRoomView,
    accountingReportsIndexView,
    accountingReportsDetailView,
    accountingCloseView,
  ],
  commands: [
    { id: "accounting.go.control-room", label: "Accounting: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/accounting/control-room"; } },
    { id: "accounting.go.reports", label: "Accounting: Reports", icon: "BarChart3", run: () => { window.location.hash = "/accounting/reports"; } },
    { id: "accounting.go.close", label: "Accounting: Month-end close", icon: "CalendarCheck", run: () => { window.location.hash = "/accounting/close"; } },
    { id: "accounting.new-invoice", label: "New invoice", icon: "FileText", shortcut: "I", run: () => { window.location.hash = "/accounting/invoices/new"; } },
    { id: "accounting.record-payment", label: "Record payment", icon: "CreditCard", run: () => { window.location.hash = "/accounting/payment-entries/new"; } },
    { id: "accounting.post-journal", label: "Post journal entry", icon: "NotebookPen", run: () => { window.location.hash = "/accounting/journal-entries/new"; } },
    { id: "accounting.new-bill", label: "New bill", icon: "FileMinus", run: () => { window.location.hash = "/accounting/bills/new"; } },
    { id: "accounting.new-budget", label: "New budget", icon: "Gauge", run: () => { window.location.hash = "/accounting/budgets/new"; } },
  ],
});
