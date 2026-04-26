import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_LIFECYCLE, STATUS_ACTIVE, CURRENCY } from "./_factory/options";
import { COMPANIES, code, daysAgo, daysFromNow, money, personName, pick } from "./_factory/seeds";
import {
  procurementControlRoomView,
  procurementReportsIndexView,
  procurementReportsDetailView,
} from "./procurement-dashboard";

const CATEGORIES = [
  { value: "raw-materials", label: "Raw materials" },
  { value: "finished-goods", label: "Finished goods" },
  { value: "services", label: "Services" },
  { value: "software", label: "Software" },
  { value: "hardware", label: "Hardware" },
  { value: "office-supplies", label: "Office supplies" },
  { value: "logistics", label: "Logistics" },
];

export const procurementPlugin = buildDomainPlugin({
  id: "procurement",
  label: "Procurement",
  icon: "ShoppingCart",
  section: SECTIONS.supplyChain,
  order: 3,
  resources: [
    {
      id: "purchase-order",
      singular: "Purchase Order",
      plural: "Purchase Orders",
      icon: "ShoppingCart",
      path: "/procurement/pos",
      displayField: "number",
      defaultSort: { field: "createdAt", dir: "desc" },
      pageSize: 25,
      erp: {
        documentType: "buying.Purchase Order",
        module: "Buying",
        namingSeries: "PUR-ORD-.YYYY.-.#####",
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
              { name: "item", kind: "link", referenceTo: "inventory.item", required: true },
              { name: "quantity", kind: "number", required: true },
              { name: "rate", kind: "currency", required: true },
              { name: "amount", kind: "currency", readonly: true },
              { name: "warehouse", kind: "link", referenceTo: "inventory.warehouse" }
            ]
          },
          {
            field: "taxes",
            label: "Taxes",
            amountField: "taxAmount",
            fields: [
              { name: "account", kind: "link", referenceTo: "accounting.account" },
              { name: "rate", kind: "number" },
              { name: "taxAmount", kind: "currency" }
            ]
          }
        ],
        links: [
          { field: "vendor", targetResourceId: "procurement.supplier", reverseRelation: "purchase-orders" },
          { field: "requisitionCode", targetResourceId: "procurement.requisition", reverseRelation: "purchase-orders" }
        ],
        mappingActions: [
          {
            id: "purchase-order-to-receipt",
            label: "Create Purchase Receipt",
            relation: "received-by",
            targetResourceId: "inventory.purchase-receipt",
            targetDocumentType: "stock.Purchase Receipt",
            visibleInStatuses: ["approved", "published"],
            fieldMap: { supplier: "vendor", linkedPo: "code", amount: "total" },
            childTableMap: { items: "items" },
            defaults: { status: "draft" }
          },
          {
            id: "purchase-order-to-bill",
            label: "Create Purchase Invoice",
            relation: "billed-by",
            targetResourceId: "accounting.bill",
            targetDocumentType: "accounts.Purchase Invoice",
            visibleInStatuses: ["approved", "published"],
            fieldMap: { vendor: "vendor", purchaseOrder: "code", amount: "total" },
            childTableMap: { items: "items", taxes: "taxes" },
            defaults: { status: "draft" }
          }
        ],
        printFormats: [{ id: "purchase-order", label: "Purchase Order", default: true, paperSize: "A4" }],
        portal: { route: "/supplier/purchase-orders/:id", audience: "supplier", enabledByDefault: true },
        workspaceLinks: [
          { label: "Purchase Receipts", path: "/inventory/purchase-receipts", kind: "document", group: "Receive" },
          { label: "Purchase Invoices", path: "/accounting/bills", kind: "document", group: "Bill" },
          { label: "Purchase Analytics", path: "/procurement/reports/purchase-analytics", kind: "report", group: "Reports" }
        ]
      },
      fields: [
        { name: "number", kind: "text", required: true, sortable: true, width: 130 },
        { name: "vendor", kind: "text", required: true, sortable: true },
        { name: "category", kind: "enum", options: CATEGORIES, sortable: true },
        { name: "buyer", kind: "text" },
        { name: "status", kind: "enum", required: true, options: STATUS_LIFECYCLE, sortable: true },
        { name: "createdAt", kind: "date", sortable: true, width: 130 },
        { name: "approvedAt", kind: "date" },
        { name: "expectedAt", kind: "date", sortable: true, width: 130 },
        { name: "receivedAt", kind: "date", sortable: true },
        { name: "subtotal", kind: "currency", align: "right" },
        { name: "tax", kind: "currency", align: "right" },
        { name: "shipping", kind: "currency", align: "right" },
        { name: "total", kind: "currency", align: "right", required: true, sortable: true },
        { name: "listTotal", label: "List total", kind: "currency", align: "right" },
        { name: "currency", kind: "enum", options: CURRENCY, width: 100 },
        { name: "requisitionCode", kind: "text" },
        { name: "linesCount", label: "Lines", kind: "number", align: "right", width: 90 },
        { name: "notes", kind: "textarea", formSection: "Notes" },
      ],
      seedCount: 30,
      seed: (i) => {
        const subtotal = money(i, 500, 50000);
        const tax = Math.round(subtotal * 0.08);
        const shipping = 50 + (i * 13) % 500;
        const total = subtotal + tax + shipping;
        return {
          number: code("PO", i, 6),
          vendor: pick(COMPANIES, i + 2),
          category: pick(CATEGORIES.map((c) => c.value), i),
          buyer: personName(i),
          status: pick(["draft", "pending", "approved", "approved", "published"], i),
          createdAt: daysAgo(i * 2),
          approvedAt: i % 4 !== 0 ? daysAgo(i * 2 - 1) : "",
          expectedAt: daysFromNow(i * 3),
          receivedAt: i % 3 === 2 ? daysAgo(i - 2) : "",
          subtotal,
          tax,
          shipping,
          total,
          listTotal: Math.round(total * 1.1),
          currency: pick(["USD", "EUR", "GBP"], i),
          requisitionCode: code("PR", i % 10, 5),
          linesCount: 1 + (i % 10),
          notes: "",
        };
      },
    },
    {
      id: "supplier",
      singular: "Supplier",
      plural: "Suppliers",
      icon: "Handshake",
      path: "/procurement/suppliers",
      fields: [
        { name: "code", kind: "text", required: true, sortable: true, width: 100 },
        { name: "name", kind: "text", required: true, sortable: true },
        { name: "category", kind: "enum", options: CATEGORIES, sortable: true },
        { name: "contactName", kind: "text" },
        { name: "contactEmail", kind: "email" },
        { name: "contactPhone", kind: "phone" },
        { name: "paymentTerms", kind: "enum", options: [
          { value: "net-15", label: "Net 15" },
          { value: "net-30", label: "Net 30" },
          { value: "net-45", label: "Net 45" },
          { value: "net-60", label: "Net 60" },
          { value: "prepaid", label: "Prepaid" },
        ] },
        { name: "currency", kind: "enum", options: CURRENCY, width: 100 },
        { name: "onTimeRate", label: "On-time %", kind: "number", align: "right", width: 110 },
        { name: "qualityScore", kind: "number", align: "right", width: 110 },
        { name: "totalSpend", kind: "currency", align: "right", sortable: true },
        { name: "lastOrderAt", kind: "date" },
        { name: "status", kind: "enum", required: true, options: STATUS_ACTIVE },
      ],
      seedCount: 20,
      seed: (i) => ({
        code: code("SUP", i, 4),
        name: pick([
          "Acme Supply", "Globex Parts", "Initech Components", "Umbrella Hardware",
          "Hooli Logistics", "Pied Piper Warehousing", "Stark Industries",
          "Dunder Mifflin", "Cyberdyne Systems", "Soylent Foods",
        ], i),
        category: pick(CATEGORIES.map((c) => c.value), i),
        contactName: personName(i),
        contactEmail: `contact${i}@supplier.com`,
        contactPhone: `+1-555-${String(5000 + i).slice(-4)}`,
        paymentTerms: pick(["net-30", "net-30", "net-45", "net-15", "prepaid"], i),
        currency: pick(["USD", "EUR", "GBP"], i),
        onTimeRate: 75 + (i * 2) % 25,
        qualityScore: 80 + (i * 3) % 20,
        totalSpend: 10_000 + (i * 7_537) % 500_000,
        lastOrderAt: daysAgo(i * 7),
        status: i === 19 ? "inactive" : "active",
      }),
    },
    {
      id: "requisition",
      singular: "Purchase Requisition",
      plural: "Purchase Requisitions",
      icon: "ClipboardList",
      path: "/procurement/requisitions",
      displayField: "code",
      defaultSort: { field: "submittedAt", dir: "desc" },
      erp: {
        documentType: "stock.Material Request",
        module: "Buying",
        namingSeries: "MAT-MR-.YYYY.-.#####",
        statusField: "status",
        submittedStatuses: ["submitted", "approved", "converted"],
        childTables: [
          {
            field: "items",
            label: "Items",
            itemField: "item",
            quantityField: "quantity",
            fields: [
              { name: "item", kind: "link", referenceTo: "inventory.item", required: true },
              { name: "quantity", kind: "number", required: true },
              { name: "warehouse", kind: "link", referenceTo: "inventory.warehouse" },
              { name: "requiredBy", kind: "date" }
            ]
          }
        ],
        mappingActions: [
          {
            id: "requisition-to-rfq",
            label: "Create RFQ",
            relation: "requested-by",
            targetResourceId: "procurement.rfq",
            targetDocumentType: "buying.Request for Quotation",
            visibleInStatuses: ["approved", "submitted"],
            childTableMap: { items: "items" },
            defaults: { status: "draft" }
          },
          {
            id: "requisition-to-po",
            label: "Create Purchase Order",
            relation: "ordered-by",
            targetResourceId: "procurement.purchase-order",
            targetDocumentType: "buying.Purchase Order",
            visibleInStatuses: ["approved", "submitted"],
            childTableMap: { items: "items" },
            defaults: { status: "draft" }
          }
        ],
        workspaceLinks: [
          { label: "RFQs", path: "/procurement/rfqs", kind: "document", group: "Source" },
          { label: "Purchase Orders", path: "/procurement/pos", kind: "document", group: "Order" }
        ]
      },
      fields: [
        { name: "code", kind: "text", required: true, sortable: true, width: 120 },
        { name: "requester", kind: "text" },
        { name: "department", kind: "text" },
        { name: "category", kind: "enum", options: CATEGORIES },
        { name: "items", kind: "number", align: "right" },
        { name: "estimatedValue", kind: "currency", align: "right", sortable: true },
        { name: "neededBy", kind: "date" },
        { name: "submittedAt", kind: "date", sortable: true },
        { name: "approver", kind: "text" },
        { name: "status", kind: "enum", required: true, options: [
          { value: "draft", label: "Draft", intent: "neutral" },
          { value: "submitted", label: "Submitted", intent: "info" },
          { value: "approved", label: "Approved", intent: "success" },
          { value: "rejected", label: "Rejected", intent: "danger" },
          { value: "converted", label: "Converted to PO", intent: "accent" },
        ] },
        { name: "linkedPo", label: "Linked PO", kind: "text" },
      ],
      seedCount: 20,
      seed: (i) => ({
        code: code("PR", i, 5),
        requester: personName(i),
        department: pick(["Engineering", "Ops", "Sales", "Marketing", "Finance"], i),
        category: pick(CATEGORIES.map((c) => c.value), i),
        items: 1 + (i % 8),
        estimatedValue: 500 + (i * 817) % 25000,
        neededBy: daysFromNow(7 + i * 3),
        submittedAt: daysAgo(i * 2),
        approver: personName(i + 3),
        status: pick(["submitted", "approved", "converted", "draft", "rejected"], i),
        linkedPo: i % 3 === 2 ? code("PO", i, 6) : "",
      }),
    },
    {
      id: "rfq",
      singular: "RFQ",
      plural: "RFQs",
      icon: "FileQuestion",
      path: "/procurement/rfqs",
      displayField: "code",
      defaultSort: { field: "issuedAt", dir: "desc" },
      erp: {
        documentType: "buying.Request for Quotation",
        module: "Buying",
        namingSeries: "PUR-RFQ-.YYYY.-.#####",
        statusField: "status",
        submittedStatuses: ["issued", "closed", "awarded"],
        childTables: [
          {
            field: "suppliers",
            label: "Suppliers",
            fields: [
              { name: "supplier", kind: "link", referenceTo: "procurement.supplier", required: true },
              { name: "contactEmail", kind: "email" }
            ]
          },
          {
            field: "items",
            label: "Items",
            itemField: "item",
            quantityField: "quantity",
            fields: [
              { name: "item", kind: "link", referenceTo: "inventory.item", required: true },
              { name: "quantity", kind: "number", required: true }
            ]
          }
        ],
        mappingActions: [
          {
            id: "rfq-to-supplier-quotation",
            label: "Record Supplier Quotation",
            relation: "quoted-by",
            targetResourceId: "procurement.supplier-quotation",
            targetDocumentType: "buying.Supplier Quotation",
            visibleInStatuses: ["issued", "closed"],
            childTableMap: { items: "items" },
            defaults: { status: "draft" }
          },
          {
            id: "rfq-to-purchase-order",
            label: "Award Purchase Order",
            relation: "awarded-as",
            targetResourceId: "procurement.purchase-order",
            targetDocumentType: "buying.Purchase Order",
            visibleInStatuses: ["awarded"],
            childTableMap: { items: "items" },
            defaults: { status: "draft" }
          }
        ],
        printFormats: [{ id: "rfq", label: "Request for Quotation", default: true }],
        portal: { route: "/supplier/rfqs/:id", audience: "supplier", enabledByDefault: true }
      },
      fields: [
        { name: "code", kind: "text", required: true, sortable: true },
        { name: "title", kind: "text", required: true, sortable: true },
        { name: "category", kind: "enum", options: CATEGORIES },
        { name: "suppliersInvited", kind: "number", align: "right" },
        { name: "quotesReceived", kind: "number", align: "right" },
        { name: "issuedAt", kind: "date", sortable: true },
        { name: "dueAt", kind: "date" },
        { name: "awardedSupplier", kind: "text" },
        { name: "status", kind: "enum", required: true, options: [
          { value: "draft", label: "Draft", intent: "neutral" },
          { value: "issued", label: "Issued", intent: "info" },
          { value: "closed", label: "Closed", intent: "warning" },
          { value: "awarded", label: "Awarded", intent: "success" },
          { value: "cancelled", label: "Cancelled", intent: "danger" },
        ] },
      ],
      seedCount: 10,
      seed: (i) => ({
        code: code("RFQ", i, 5),
        title: pick([
          "Bulk motor supply Q2",
          "Office IT refresh",
          "Logistics services 2026",
          "Cleaning services contract",
          "SaaS platform negotiation",
        ], i),
        category: pick(CATEGORIES.map((c) => c.value), i),
        suppliersInvited: 3 + (i % 5),
        quotesReceived: Math.max(1, 3 + (i % 5) - (i % 3)),
        issuedAt: daysAgo(i * 10),
        dueAt: daysFromNow(14 - i),
        awardedSupplier: i % 3 === 0 ? pick(COMPANIES, i) : "",
        status: pick(["issued", "closed", "awarded", "awarded", "cancelled"], i),
      }),
    },
    {
      id: "contract",
      singular: "Supplier Contract",
      plural: "Supplier Contracts",
      icon: "FileSignature",
      path: "/procurement/contracts",
      displayField: "code",
      fields: [
        { name: "code", kind: "text", required: true, sortable: true },
        { name: "supplier", kind: "text", required: true, sortable: true },
        { name: "title", kind: "text" },
        { name: "startAt", kind: "date" },
        { name: "endAt", kind: "date", sortable: true },
        { name: "autoRenew", kind: "boolean" },
        { name: "committedSpend", kind: "currency", align: "right" },
        { name: "status", kind: "enum", options: [
          { value: "draft", label: "Draft", intent: "neutral" },
          { value: "active", label: "Active", intent: "success" },
          { value: "expiring-soon", label: "Expiring soon", intent: "warning" },
          { value: "expired", label: "Expired", intent: "danger" },
        ] },
      ],
      seedCount: 12,
      seed: (i) => ({
        code: code("SC", i, 5),
        supplier: pick(COMPANIES, i + 2),
        title: pick(["Master supply agreement", "SaaS license", "Maintenance contract", "Logistics agreement"], i),
        startAt: daysAgo(365 - i * 30),
        endAt: daysFromNow(365 - i * 30),
        autoRenew: i % 2 === 0,
        committedSpend: 10_000 + (i * 7537) % 200_000,
        status: pick(["active", "active", "active", "expiring-soon", "expired"], i),
      }),
    },
    {
      id: "goods-receipt",
      singular: "Goods Receipt",
      plural: "Goods Receipts",
      icon: "PackageCheck",
      path: "/procurement/receipts",
      displayField: "code",
      defaultSort: { field: "receivedAt", dir: "desc" },
      erp: {
        documentType: "buying.Purchase Receipt",
        module: "Buying",
        namingSeries: "MAT-PRE-.YYYY.-.#####",
        statusField: "qcStatus",
        submittedStatuses: ["passed", "partial"],
        childTables: [
          {
            field: "items",
            label: "Received Items",
            itemField: "item",
            quantityField: "receivedQty",
            amountField: "amount",
            fields: [
              { name: "item", kind: "link", referenceTo: "inventory.item", required: true },
              { name: "orderedQty", kind: "number" },
              { name: "receivedQty", kind: "number", required: true },
              { name: "rejectedQty", kind: "number" },
              { name: "warehouse", kind: "link", referenceTo: "inventory.warehouse" },
              { name: "amount", kind: "currency" }
            ]
          }
        ],
        links: [
          { field: "poNumber", targetResourceId: "procurement.purchase-order", reverseRelation: "receipts" },
          { field: "supplier", targetResourceId: "procurement.supplier", reverseRelation: "receipts" }
        ],
        mappingActions: [
          {
            id: "receipt-to-stock-ledger",
            label: "Post Stock Ledger",
            relation: "posts-stock",
            targetResourceId: "inventory.stock-entry",
            targetDocumentType: "stock.Stock Entry",
            visibleInStatuses: ["passed", "partial"],
            fieldMap: { supplier: "supplier", linkedPo: "poNumber" },
            childTableMap: { items: "items" },
            defaults: { status: "draft", kind: "receipt" }
          },
          {
            id: "receipt-to-bill",
            label: "Create Purchase Invoice",
            relation: "billed-by",
            targetResourceId: "accounting.bill",
            targetDocumentType: "accounts.Purchase Invoice",
            visibleInStatuses: ["passed", "partial"],
            fieldMap: { vendor: "supplier", purchaseReceipt: "code", amount: "amount" },
            childTableMap: { items: "items" },
            defaults: { status: "draft" }
          }
        ],
        printFormats: [{ id: "purchase-receipt", label: "Purchase Receipt", default: true }]
      },
      fields: [
        { name: "code", kind: "text", required: true, sortable: true, width: 120 },
        { name: "poNumber", label: "PO", kind: "text", required: true },
        { name: "supplier", kind: "text", sortable: true },
        { name: "receivedAt", kind: "date", required: true, sortable: true },
        { name: "receivedBy", kind: "text" },
        { name: "itemsCount", kind: "number", align: "right" },
        { name: "qcStatus", kind: "enum", options: [
          { value: "pending", label: "Pending", intent: "warning" },
          { value: "passed", label: "Passed", intent: "success" },
          { value: "partial", label: "Partial", intent: "info" },
          { value: "rejected", label: "Rejected", intent: "danger" },
        ] },
        { name: "totalValue", kind: "currency", align: "right" },
      ],
      seedCount: 20,
      seed: (i) => ({
        code: code("GR", i, 6),
        poNumber: code("PO", i, 6),
        supplier: pick(COMPANIES, i + 2),
        receivedAt: daysAgo(i * 2),
        receivedBy: personName(i),
        itemsCount: 1 + (i % 8),
        qcStatus: pick(["passed", "passed", "pending", "partial", "rejected"], i),
        totalValue: 500 + (i * 1_173) % 25_000,
      }),
    },
    {
      id: "approval-rule",
      singular: "Approval Rule",
      plural: "Approval Rules",
      icon: "ShieldCheck",
      path: "/procurement/approval-rules",
      fields: [
        { name: "name", kind: "text", required: true, sortable: true },
        { name: "category", kind: "enum", options: CATEGORIES },
        { name: "maxAmount", label: "Max amount", kind: "currency", align: "right" },
        { name: "minAmount", label: "Min amount", kind: "currency", align: "right" },
        { name: "approverRole", kind: "text" },
        { name: "active", kind: "boolean" },
      ],
      seedCount: 6,
      seed: (i) => ({
        name: pick(["Small purchases", "Department head approval", "CFO approval", "CEO approval"], i),
        category: pick(CATEGORIES.map((c) => c.value), i),
        maxAmount: pick([1000, 10000, 100000, 1_000_000], i),
        minAmount: pick([0, 1001, 10001, 100001], i),
        approverRole: pick(["Manager", "Department head", "VP", "CFO", "CEO"], i),
        active: true,
      }),
    },
  ],
  extraNav: [
    { id: "procurement.control-room.nav", label: "Procurement Control Room", icon: "LayoutDashboard", path: "/procurement/control-room", view: "procurement.control-room.view", order: 0 },
    { id: "procurement.reports.nav", label: "Reports", icon: "BarChart3", path: "/procurement/reports", view: "procurement.reports.view" },
  ],
  extraViews: [
    procurementControlRoomView,
    procurementReportsIndexView,
    procurementReportsDetailView,
  ],
  commands: [
    { id: "procurement.go.control-room", label: "Procurement: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/procurement/control-room"; } },
    { id: "procurement.go.reports", label: "Procurement: Reports", icon: "BarChart3", run: () => { window.location.hash = "/procurement/reports"; } },
    { id: "procurement.new-po", label: "New PO", icon: "Plus", run: () => { window.location.hash = "/procurement/pos/new"; } },
    { id: "procurement.new-pr", label: "New requisition", icon: "ClipboardList", run: () => { window.location.hash = "/procurement/requisitions/new"; } },
    { id: "procurement.new-rfq", label: "New RFQ", icon: "FileQuestion", run: () => { window.location.hash = "/procurement/rfqs/new"; } },
    { id: "procurement.new-supplier", label: "New supplier", icon: "Handshake", run: () => { window.location.hash = "/procurement/suppliers/new"; } },
  ],
});
